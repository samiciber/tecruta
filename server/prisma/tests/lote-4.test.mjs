// Docker, Node and Prisma only. Every request uses loopback; Google/mail are stubs.
import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, randomUUID } from 'node:crypto'
import express from '../../node_modules/express/index.js'
import bcrypt from '../../node_modules/bcryptjs/index.js'
import { hash, challenge, CODE_TTL_MS, UNIFORM_AUTH_RESPONSE } from '../../src/lib/authSecurity.js'
import { createEmptyDotenv, createPrismaWorkspace, runDocker, runPrisma } from './helpers/isolated-runtime.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const source = process.env.TECRUTA_QA_MIGRATIONS_DIR || join(root, 'server/prisma/migrations')
const migration = '20261012000002_add_secure_auth_codes_oauth_sessions'
const nav = '20261012000000_add_nav_brands_stores_saved_items'
const schema = join(root, 'server/prisma/schema.prisma')
const container = `tecruta-lote4-test-${process.pid}`
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
const temp = mkdtempSync(join(tmpdir(), 'tecruta-lote4-'))
const dotenvPath = createEmptyDotenv(temp)
const mail = new Map(), providerCodes = new Map()
const serverErrors = []
let workspace, db, server, base, started, loginLimit, actionLimit, signSession, signToken
let clock = Date.now(), providerCalls = 0, failMail = false
const password = randomBytes(24).toString('hex')
function docker(...args) { return runDocker(args) }
function sql(database, input) { return runDocker(['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'qa_lote4', '-d', database], { input }).trim() }
function prismaWithUrl(databaseUrl, ...args) {
  const sandboxedArgs = [...args]
  if (!sandboxedArgs.includes('--schema')) sandboxedArgs.push('--schema', workspace.schemaPath)
  return runPrisma({ root, tempRoot: temp, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl, args: sandboxedArgs })
}
const prisma = (...args) => prismaWithUrl(process.env.DATABASE_URL, ...args)
async function request(path, { method = 'GET', body, token, cookie } = {}) {
  const response = await fetch(base + path, { method, redirect: 'manual', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json().catch(() => null), location: response.headers.get('location'), cookie: response.headers.get('set-cookie') }
}
const post = (path, body, token) => request('/api/auth/' + path, { method: 'POST', body, token })
const uniqueEmail = () => randomUUID() + '@qa.invalid'
const lastCode = (email, purpose) => mail.get(email + ':' + purpose)?.at(-1)
const mailCount = (email, purpose) => mail.get(email + ':' + purpose)?.length || 0
async function register(email = uniqueEmail()) {
  const result = await post('register', { email, password, nombre: 'QA', apellido: 'Example' })
  assert.equal(result.status, 202)
  return { email, code: lastCode(email, 'verify') }
}
async function login(email = 'qa-old@example.invalid', pass = password) {
  return post('login', { email, password: pass })
}
async function flow(profile = { sub: randomUUID(), email: uniqueEmail(), email_verified: true }) {
  const verifier = randomBytes(32).toString('base64url')
  const result = await request('/api/auth/google?challenge=' + challenge(verifier))
  assert.equal(result.status, 302)
  const destination = new URL(result.location)
  assert.equal(destination.searchParams.get('code_challenge_method'), 'S256')
  const state = destination.searchParams.get('state')
  const code = randomBytes(32).toString('base64url')
  providerCodes.set(code, { challenge: destination.searchParams.get('code_challenge'), profile })
  return { state, code, verifier, cookie: result.cookie.split(';')[0], cookieHeader: result.cookie }
}
const callback = f => request('/api/auth/google/callback?code=' + f.code + '&state=' + f.state, { cookie: f.cookie })
const exchangeCode = result => new URL(result.location).searchParams.get('code')

before(async () => {
  assert.ok(existsSync(join(source, nav, 'migration.sql')), 'Integrate Lote 2 first or provide its unchanged SQL through TECRUTA_QA_MIGRATIONS_DIR')
  docker('info', '--format', '{{.ServerVersion}}')
  docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=qa_lote4', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image)
  started = true
  const connection = `postgresql://qa_lote4@${docker('port', container, '5432/tcp')}`
  process.env.DATABASE_URL = connection + '/qa_auth'
  process.env.JWT_SECRET = randomBytes(32).toString('hex')
  process.env.NODE_ENV = 'test'
  process.env.GOOGLE_CLIENT_ID = 'qa-client'
  process.env.GOOGLE_CLIENT_SECRET = randomBytes(32).toString('hex')
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost/api/auth/google/callback'
  process.env.CORS_ORIGIN = 'http://qa.invalid'
  process.env.DOTENV_CONFIG_PATH = dotenvPath
  let ready = false
  for (let i = 0; i < 40; i++) {
    try { sql('postgres', 'SELECT 1'); ready = true; break } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready)
  sql('postgres', 'CREATE DATABASE qa_auth; CREATE DATABASE qa_shadow; CREATE DATABASE qa_fresh;')
  workspace = createPrismaWorkspace({ tempRoot: temp, name: 'prisma', schemaSource: schema, migrationsSource: source, excludedMigrations: [migration] })
  prisma('migrate', 'deploy', '--schema', workspace.schemaPath)
  const passwordHash = await bcrypt.hash(password, 10)
  sql('qa_auth', `INSERT INTO users (id, email, "passwordHash", nombre, apellido, role, verified, "verificationCode", "resetCode", "updatedAt") VALUES ('qa-old', 'qa-old@example.invalid', '${passwordHash}', 'QA', 'Old', 'ADMIN', true, 'legacy-verification', 'legacy-reset', '2026-01-01');`)
  cpSync(join(source, migration), join(workspace.migrationsPath, migration), { recursive: true })
  prisma('migrate', 'deploy', '--schema', workspace.schemaPath)
  const client = await import('../../src/lib/prisma.js'); db = client.prisma
  const tokens = await import('../../src/lib/token.js'); signSession = tokens.signSession; signToken = tokens.signToken
  const { createAuthRouter } = await import('../../src/routes/auth.routes.js')
  const limits = await import('../../src/middleware/rateLimit.js'); loginLimit = limits.loginRateLimiter; actionLimit = limits.authActionRateLimiter
  const { buildGoogleAuthUrl } = await import('../../src/lib/google.js')
  const { errorHandler } = await import('../../src/middleware/errorHandler.js')
  const { createAuthMiddleware } = await import('../../src/middleware/auth.js')
  const deliver = purpose => async ({ to, code }) => {
    if (failMail) throw new Error('QA mail failure')
    const key = to + ':' + purpose
    mail.set(key, [...mail.get(key) || [], code])
  }
  const google = { authorizationUrl: buildGoogleAuthUrl, exchange: async (code, verifier) => {
    providerCalls++
    const record = providerCodes.get(code)
    if (!record || record.challenge !== challenge(verifier)) throw new Error('QA PKCE mismatch')
    return code
  }, profile: async code => providerCodes.get(code).profile }
  const app = express(); app.set('trust proxy', 0); app.use(express.json({ limit: '100kb' }))
  app.use('/api/auth', createAuthRouter({ db, now: () => new Date(clock), mailer: { verification: deliver('verify'), reset: deliver('reset') }, google }))
  const broken = createAuthMiddleware({ db: { user: { findUnique: async () => { throw new Error('QA database unavailable') } } } })
  app.get('/qa/required', broken.requireAuth, (_req, res) => res.json({ ok: true }))
  app.get('/qa/optional', broken.optionalAuth, (_req, res) => res.json({ ok: true }))
  app.use((error, req, res, next) => { serverErrors.push(error.code); errorHandler(error, req, res, next) })
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  base = 'http://127.0.0.1:' + server.address().port
})
beforeEach(() => { loginLimit?.resetKey('127.0.0.1'); actionLimit?.resetKey('127.0.0.1'); failMail = false })
after(async () => {
  try { if (server) await new Promise(resolve => server.close(resolve)); if (db) await db.$disconnect() }
  finally { try { if (started) docker('rm', '--force', '--volumes', container) } finally { rmSync(temp, { recursive: true, force: true }) } }
})

test('migration preserves account/password/role, invalidates plaintext codes and matches schema from zero/history', async () => {
  const old = await db.user.findUnique({ where: { id: 'qa-old' } })
  assert.equal(old.role, 'ADMIN'); assert.equal(old.email, 'qa-old@example.invalid'); assert.ok(old.verified)
  assert.ok(await bcrypt.compare(password, old.passwordHash))
  assert.equal(old.verificationCode, null); assert.equal(old.resetCode, null); assert.equal(old.tokenVersion, 0)
  assert.match(prisma('migrate', 'diff', '--from-schema-datasource', workspace.schemaPath, '--to-schema-datamodel', workspace.schemaPath, '--script', '--exit-code'), /empty migration/)
  assert.match(prisma('migrate', 'diff', '--from-migrations', workspace.migrationsPath, '--to-schema-datamodel', workspace.schemaPath,
    '--shadow-database-url', process.env.DATABASE_URL.replace('/qa_auth', '/qa_shadow'), '--script', '--exit-code'), /empty migration/)
  prismaWithUrl(process.env.DATABASE_URL.replace('/qa_auth', '/qa_fresh'), 'migrate', 'deploy', '--schema', workspace.schemaPath)
  assert.equal(Number(sql('qa_fresh', 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;')), readdirSync(source).filter(name => /^\d/.test(name)).length)
  assert.match(prisma('migrate', 'deploy', '--schema', workspace.schemaPath), /No pending migrations/)
})
test('registration/resend/recovery have identical 202 responses for new, existing, missing and failed-mail cases', async () => {
  const initial = await register()
  const before = await db.user.findUnique({ where: { email: initial.email } })
  const duplicate = await post('register', { email: initial.email.toUpperCase(), password: randomBytes(24).toString('hex'), nombre: 'Changed', apellido: 'Changed' })
  assert.equal(duplicate.status, 202); assert.deepEqual(duplicate.data, UNIFORM_AUTH_RESPONSE)
  const after = await db.user.findUnique({ where: { email: initial.email } })
  assert.ok(after.passwordHash === before.passwordHash); assert.equal(after.nombre, 'QA')
  for (const path of ['resend-code', 'forgot-password']) for (const email of [initial.email, 'qa-old@example.invalid', uniqueEmail()]) {
    const result = await post(path, { email }); assert.equal(result.status, 202); assert.deepEqual(result.data, UNIFORM_AUTH_RESPONSE)
  }
  failMail = true
  const failed = await register(); assert.ok(!lastCode(failed.email, 'verify'))
  const known = await post('register', { email: 'qa-old@example.invalid', password, nombre: 'QA', apellido: 'QA' })
  assert.equal(known.status, 202); assert.deepEqual(known.data, UNIFORM_AUTH_RESPONSE)
})
test('verification hash expires, is single-use and succeeds once under simultaneous requests', async () => {
  const account = await register()
  const user = await db.user.findUnique({ where: { email: account.email } })
  assert.ok(user.verificationCodeHash && user.verificationCodeHash !== account.code && user.verificationCode === null)
  assert.equal(user.verificationCodeExpiresAt.getTime(), clock + CODE_TTL_MS)
  const results = await Promise.all([post('verify', account), post('verify', account)])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400])
  assert.equal((await post('verify', account)).status, 400)
  const expired = await register(); clock += CODE_TTL_MS + 1
  assert.equal((await post('verify', expired)).status, 400)
  assert.equal((await post('verify', { email: uniqueEmail(), code: expired.code })).status, 400)
})
test('five wrong attempts lock an account; resending cannot reset the limit; independent reset codes are protected', async () => {
  const account = await register()
  const wrong = String((Number(account.code) + 1) % 1000000).padStart(6, '0')
  for (let i = 0; i < 5; i++) assert.equal((await post('verify', { email: account.email, code: wrong })).status, 400)
  const locked = await db.user.findUnique({ where: { email: account.email } })
  assert.equal(locked.verificationCodeAttempts, 5); assert.ok(locked.verificationCodeLockedUntil.getTime() > clock)
  clock += 61000
  const sent = mailCount(account.email, 'verify')
  assert.equal((await post('resend-code', { email: account.email })).status, 202)
  assert.equal(mailCount(account.email, 'verify'), sent)
  assert.equal((await post('verify', account)).status, 400)
  clock += CODE_TTL_MS
  assert.equal((await post('resend-code', { email: account.email })).status, 202)
  assert.equal((await post('verify', { email: account.email, code: lastCode(account.email, 'verify') })).status, 200)
  loginLimit.resetKey('127.0.0.1')
  await post('forgot-password', { email: account.email })
  const reset = lastCode(account.email, 'reset'), badReset = String((Number(reset) + 1) % 1000000).padStart(6, '0')
  for (let i = 0; i < 5; i++) assert.equal((await post('reset-password', { email: account.email, code: badReset, newPassword: password })).status, 400)
  assert.equal((await post('reset-password', { email: account.email, code: reset, newPassword: password })).status, 400)
  assert.equal((await db.user.findUnique({ where: { email: account.email } })).resetCodeAttempts, 5)
})
test('resend cooldown rotates hashes without resetting wrong-attempt count', async () => {
  const account = await register(), first = account.code
  await post('resend-code', { email: account.email }); assert.equal(mailCount(account.email, 'verify'), 1)
  const wrong = String((Number(first) + 1) % 1000000).padStart(6, '0')
  await post('verify', { email: account.email, code: wrong }); clock += 61000
  await post('resend-code', { email: account.email })
  assert.equal(mailCount(account.email, 'verify'), 2)
  assert.equal((await db.user.findUnique({ where: { email: account.email } })).verificationCodeAttempts, 1)
})
test('state is random/cookie-bound, expires and only one concurrent callback reaches Google with PKCE', async () => {
  const f = await flow(), calls = providerCalls
  assert.ok(f.cookieHeader.includes('HttpOnly') && f.cookieHeader.includes('SameSite=Lax') && f.cookieHeader.includes('Max-Age=300'))
  const row = await db.oAuthFlow.findUnique({ where: { stateHash: hash(f.state) } })
  assert.ok(row && row.stateHash !== f.state && !Object.hasOwn(row, 'verifier'))
  const missing = await request('/api/auth/google/callback?code=' + f.code + '&state=' + f.state)
  assert.ok(new URL(missing.location).searchParams.get('googleError') === 'state')
  const other = await flow()
  const wrong = await request('/api/auth/google/callback?code=' + f.code + '&state=' + f.state, { cookie: other.cookie })
  assert.ok(new URL(wrong.location).searchParams.get('googleError') === 'state')
  assert.equal(providerCalls, calls)
  const results = await Promise.all([callback(f), callback(f)])
  assert.equal(results.filter(result => new URL(result.location).searchParams.has('code')).length, 1)
  assert.equal(providerCalls, calls + 1)
  const expired = await flow(); clock += 5 * 60 * 1000 + 1
  assert.ok(new URL((await callback(expired)).location).searchParams.get('googleError') === 'state')
  assert.ok(!serverErrors.includes('ERR_HTTP_HEADERS_SENT'))
})
test('invalid Google claims and unverified local accounts are never linked or verified; existing other sub is not replaced', async () => {
  for (const profile of [{ sub: '', email: uniqueEmail(), email_verified: true }, { sub: randomUUID(), email: uniqueEmail(), email_verified: false }, { sub: randomUUID(), email: uniqueEmail(), email_verified: 'true' }]) {
    const result = await callback(await flow(profile)); assert.ok(new URL(result.location).searchParams.has('googleError'))
    assert.ok(!await db.user.findUnique({ where: { email: profile.email } }))
  }
  const local = await register(), before = await db.user.findUnique({ where: { email: local.email } })
  const denied = await callback(await flow({ sub: randomUUID(), email: local.email, email_verified: true }))
  assert.ok(new URL(denied.location).searchParams.get('googleError') === 'linking')
  const after = await db.user.findUnique({ where: { id: before.id } })
  assert.ok(!after.verified && after.googleId === null && after.passwordHash === before.passwordHash)
  const linked = await flow(); await callback(linked)
  const deniedOther = await callback(await flow({ sub: randomUUID(), email: providerCodes.get(linked.code).profile.email, email_verified: true }))
  assert.ok(new URL(deniedOther.location).searchParams.get('googleError') === 'linking')
})
test('exchange URL contains no session token; per-tab verifier and one-use/60-second expiry are enforced', async () => {
  const f = await flow(), result = await callback(f)
  const url = new URL(result.location); assert.ok(url.searchParams.has('code') && !url.searchParams.has('token'))
  const code = exchangeCode(result)
  const row = await db.authExchange.findUnique({ where: { codeHash: hash(code) } })
  assert.ok(row && row.codeHash !== code && row.expiresAt.getTime() === clock + 60000)
  assert.equal((await post('google/exchange', { code, verifier: randomBytes(32).toString('base64url') })).status, 401)
  const results = await Promise.all([post('google/exchange', { code, verifier: f.verifier }), post('google/exchange', { code, verifier: f.verifier })])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 401])
  const session = results.find(result => result.status === 200).data
  assert.ok(session.token && session.user && !Object.hasOwn(session.user, 'passwordHash'))
  const later = await flow(), expired = exchangeCode(await callback(later)); clock += 60001
  assert.equal((await post('google/exchange', { code: expired, verifier: later.verifier })).status, 401)
})
test('verified local account links without changing password/name/role; new Google account never inherits provider role', async () => {
  const email = uniqueEmail(), passwordHash = await bcrypt.hash(password, 10)
  const existing = await db.user.create({ data: { email, passwordHash, nombre: 'QA existing', apellido: 'Preserved', verified: true, role: 'ADMIN' } })
  const f = await flow({ sub: randomUUID(), email, email_verified: true, given_name: 'Changed' })
  const result = await callback(f)
  const signedIn = await post('google/exchange', { code: exchangeCode(result), verifier: f.verifier })
  assert.equal(signedIn.status, 200); assert.equal(signedIn.data.user.id, existing.id); assert.equal(signedIn.data.user.role, 'ADMIN')
  const after = await db.user.findUnique({ where: { id: existing.id } })
  assert.ok(after.passwordHash === existing.passwordHash && after.verified && after.googleId)
  assert.equal(after.nombre, 'QA existing'); assert.equal(after.apellido, 'Preserved')
  const newFlow = await flow({ sub: randomUUID(), email: uniqueEmail(), email_verified: true, role: 'ADMIN' })
  const created = await post('google/exchange', { code: exchangeCode(await callback(newFlow)), verifier: newFlow.verifier })
  assert.equal(created.status, 200); assert.equal(created.data.user.role, 'CUSTOMER')
})
test('production OAuth cookie is host-only, Secure, HttpOnly and Lax with a short lifetime', async () => {
  const beforeMode = process.env.NODE_ENV, beforeCallback = process.env.GOOGLE_CALLBACK_URL
  try {
    process.env.NODE_ENV = 'production'; process.env.GOOGLE_CALLBACK_URL = 'https://qa.invalid/api/auth/google/callback'
    const f = await flow()
    assert.ok(f.cookieHeader.startsWith('__Host-tecruta-oauth='))
    for (const attribute of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Max-Age=300']) assert.ok(f.cookieHeader.includes(attribute))
    assert.ok(!f.cookieHeader.includes('Domain='))
  } finally { process.env.NODE_ENV = beforeMode; process.env.GOOGLE_CALLBACK_URL = beforeCallback }
})
test('logout-all, password change and recovery invalidate every previous version, including legacy/null version', async () => {
  await db.user.update({ where: { id: 'qa-old' }, data: { tokenVersion: null } })
  const legacy = signToken({ sub: 'qa-old' })
  assert.equal((await request('/api/auth/me', { token: legacy })).status, 200)
  assert.equal((await post('logout-all', {}, legacy)).status, 200)
  assert.equal((await request('/api/auth/me', { token: legacy })).status, 401)
  let session = await login(); assert.equal(session.status, 200)
  const nextPassword = randomBytes(24).toString('hex')
  assert.equal((await post('change-password', { currentPassword: password, newPassword: nextPassword }, session.data.token)).status, 200)
  assert.equal((await request('/api/auth/me', { token: session.data.token })).status, 401)
  assert.equal((await login()).status, 401)
  session = await login('qa-old@example.invalid', nextPassword); assert.equal(session.status, 200)
  await post('forgot-password', { email: 'qa-old@example.invalid' })
  const code = lastCode('qa-old@example.invalid', 'reset'), newPassword = randomBytes(24).toString('hex')
  assert.equal((await post('reset-password', { email: 'qa-old@example.invalid', code, newPassword })).status, 200)
  assert.equal((await request('/api/auth/me', { token: session.data.token })).status, 401)
  assert.equal((await post('reset-password', { email: 'qa-old@example.invalid', code, newPassword })).status, 400)
  assert.equal((await login('qa-old@example.invalid', newPassword)).status, 200)
})
test('revocation after callback prevents exchanging a pending Google login into a fresh session', async () => {
  const profile = { sub: randomUUID(), email: uniqueEmail(), email_verified: true }
  const f = await flow(profile), code = exchangeCode(await callback(f))
  const user = await db.user.findUnique({ where: { email: profile.email } })
  const token = signSession(user)
  assert.equal((await post('logout-all', {}, token)).status, 200)
  assert.equal((await post('google/exchange', { code, verifier: f.verifier })).status, 401)
})
test('database failures stay 500 for required/optional authentication; invalid JWT is 401', async () => {
  const token = signSession(await db.user.findUnique({ where: { id: 'qa-old' } }))
  assert.equal((await request('/qa/required', { token })).status, 500)
  assert.equal((await request('/qa/optional', { token })).status, 500)
  assert.equal((await request('/qa/optional')).status, 200)
  assert.equal((await request('/api/auth/me', { token: 'qa-invalid' })).status, 401)
})
