import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { createSeparationRuntime } from './helpers/separation-runtime.mjs'
import { createPrismaWorkspace, runPrisma, runDocker } from './helpers/isolated-runtime.mjs'
import { assignAdminUsername, normalizeAdminUsername } from '../../src/lib/adminUsername.js'
import { challenge, hash, OAUTH_TTL_MS } from '../../src/lib/authSecurity.js'
import { authFrontendOrigin } from '../../src/lib/runtimeConfig.js'

let rt, base, limits, db, providerCalls = 0, clock = Date.now()
const records = new Map(), mails = [], provider = new Map()
const password = randomBytes(24).toString('hex')
const now = () => new Date(clock)
const shop = 'https://store.example.test', panel = 'https://panel.example.test'
const adminProfile = { sub: 'qa-google-admin', email: 'qa-admin@example.test', email_verified: true }
const customerProfile = { sub: 'qa-google-customer', email: 'qa-customer@example.test', email_verified: true }
async function request(path, { body, cookie, token, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(base + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: response.status, data: await response.json().catch(() => null), location: response.headers.get('location'), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
const staffLogin = identifier => request('/api/auth/staff-login', { body: { identifier, password } })
async function start(app = 'panel', profile = adminProfile) {
  const verifier = randomBytes(32).toString('base64url')
  const response = await request(`/api/auth/google?challenge=${challenge(verifier)}&app=${app}`)
  assert.equal(response.status, 302)
  const url = new URL(response.location)
  const state = url.searchParams.get('state'), code = randomBytes(24).toString('hex')
  provider.set(code, { profile, challenge: url.searchParams.get('code_challenge') })
  return { ...response, verifier, state, code }
}
const callback = flow => request(`/api/auth/google/callback?state=${flow.state}&code=${flow.code}`, { cookie: flow.cookie })
const exchange = (flow, code, app = 'panel') => request(`/api/auth/${app === 'panel' ? 'staff-google' : 'google'}/exchange`, { body: { code, verifier: flow.verifier } })

before(async () => {
  process.env.CORS_ORIGINS = `${shop},${panel}`; process.env.STORE_ORIGIN = shop; process.env.PANEL_ORIGIN = panel
  rt = await createSeparationRuntime(); db = rt.db
  const { default: bcrypt } = await rt.load('server/node_modules/bcryptjs/index.js')
  await db.user.updateMany({ data: { passwordHash: await bcrypt.hash(password, 10) } })
  limits = await rt.load('server/src/middleware/rateLimit.js')
  base = await rt.start({ now, mailer: { verification: async () => {}, reset: async message => { mails.push(message) } }, google: {
    authorizationUrl: (state, proof) => { records.set(state, proof); return `https://accounts.example.test/authorize?state=${state}&code_challenge=${proof}&code_challenge_method=S256` },
    exchange: async (code, verifier) => { providerCalls++; assert.equal(provider.get(code)?.challenge, challenge(verifier)); return code },
    profile: async code => provider.get(code).profile,
  } })
})
beforeEach(() => { limits.loginRateLimiter.resetKey('127.0.0.1'); limits.authActionRateLimiter.resetKey('127.0.0.1') })
after(async () => { if (rt) await rt.close() })

test('minimal migration: nullable alias, original tables/data/roles and no inventory/POS', async () => {
  const user = await db.user.findUnique({ where: { id: rt.admin.id } })
  assert.equal(user.adminUsername, null); assert.equal(user.role, 'ADMIN')
  const columns = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'adminUsername'`
  assert.equal(columns.length, 1)
  const tables = await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  assert.equal(tables.some(x => /inventory_movements|pos_sales|cash_sessions/.test(x.table_name)), false)
  const migrations = await db.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY migration_name`
  assert.equal(migrations.at(-1).migration_name, '20261018000000_admin_login_alias')
  assert.equal(migrations.some(x => /inventory|pos_part/.test(x.migration_name)), false)
})
test('alias assignment is explicit, normalized and available only to verified ADMIN', async () => {
  assert.equal(normalizeAdminUsername(' ADMIN1234 '), 'admin1234')
  for (const value of ['admin@1234', 'ad min', 'abc', 'áadmin', 'admin/abc']) assert.throws(() => normalizeAdminUsername(value))
  assert.equal((await assignAdminUsername(db, rt.admin.email, 'ADMIN1234')).applied, false)
  assert.equal((await db.user.findUnique({ where: { id: rt.admin.id } })).adminUsername, null)
  await assignAdminUsername(db, rt.admin.email, ' ADMIN1234 ', { apply: true })
  await assignAdminUsername(db, rt.admin.email, 'admin1234', { apply: true })
  await assert.rejects(assignAdminUsername(db, rt.customer.email, 'CUSTOMER1', { apply: true }))
  const other = await db.user.create({ data: { email: 'other-admin@example.test', passwordHash: 'not-a-login', nombre: 'QA', apellido: 'Otro', role: 'ADMIN', verified: true } })
  await assert.rejects(assignAdminUsername(db, other.email, 'AdMiN1234', { apply: true }))
  await assert.rejects(db.user.update({ where: { id: other.id }, data: { adminUsername: 'admin1234' } }))
  await assert.rejects(db.user.update({ where: { id: other.id }, data: { adminUsername: ' ADMIN1234 ' } }))
  const third = await db.user.create({ data: { email: 'third-admin@example.test', passwordHash: 'not-a-login', nombre: 'QA', apellido: 'Tercero', role: 'ADMIN', verified: true } })
  const outcomes = await Promise.allSettled([assignAdminUsername(db, other.email, 'racealias', { apply: true }), assignAdminUsername(db, third.email, 'RaCeAlIaS', { apply: true })])
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1)
})
test('upgrade from previous migrations preserves complete existing rows and produces no schema drift', () => {
  const migration = '20261018000000_admin_login_alias'
  const sql = input => runDocker(['exec', '-i', rt.container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'qa_final_home', '-d', 'qa_admin_upgrade'], { input }).trim()
  runDocker(['exec', rt.container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'qa_final_home', '-d', 'qa_final_home', '-c', 'CREATE DATABASE qa_admin_upgrade'])
  const url = new URL(process.env.DATABASE_URL); url.pathname = '/qa_admin_upgrade'
  const setup = name => createPrismaWorkspace({ tempRoot: rt.tempRoot, name, schemaSource: join(rt.root, 'server/prisma/schema.prisma'), migrationsSource: join(rt.root, 'server/prisma/migrations'), ...(name === 'old-schema' ? { excludedMigrations: [migration] } : {}) })
  const old = setup('old-schema'), current = setup('new-schema'), dotenvPath = process.env.DOTENV_CONFIG_PATH
  const prisma = (workspace, args) => runPrisma({ root: rt.root, tempRoot: rt.tempRoot, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl: url.href, args })
  prisma(old, ['migrate', 'deploy', '--schema', old.schemaPath])
  sql(`INSERT INTO users (id,email,"passwordHash",nombre,apellido,role,verified,"googleId","updatedAt") VALUES ('qa-old-admin','legacy@example.test','synthetic-hash','QA','Legacy','ADMIN',true,'qa-old-google','2026-01-01');
    INSERT INTO categories (id,slug,name) VALUES ('qa-category','qa-category','QA');
    INSERT INTO products (id,slug,name,price,stock,"categoryId",tags,"updatedAt") VALUES ('qa-product','qa-product','Producto QA',19.90,7,'qa-category','{}','2026-01-01');`)
  const before = sql(`SELECT jsonb_build_object('user',(SELECT to_jsonb(u) FROM users u),'product',(SELECT to_jsonb(p) FROM products p))`)
  prisma(current, ['migrate', 'deploy', '--schema', current.schemaPath])
  const after = sql(`SELECT jsonb_build_object('user',(SELECT to_jsonb(u) - 'adminUsername' FROM users u),'product',(SELECT to_jsonb(p) FROM products p))`)
  assert.deepEqual(JSON.parse(after), JSON.parse(before))
  assert.equal(sql(`SELECT count(*) FROM users WHERE "adminUsername" IS NOT NULL`), '0')
  assert.match(prisma(current, ['migrate', 'diff', '--from-schema-datasource', current.schemaPath, '--to-schema-datamodel', current.schemaPath, '--script', '--exit-code']), /This is an empty migration/)
})
test('ADMIN email and alias share an account; store still accepts email only', async () => {
  const expected = (await staffLogin(rt.admin.email)).data.user.id
  for (const value of ['ADMIN1234', 'admin1234', '  AdMiN1234  ', ` ${rt.admin.email.toUpperCase()} `]) {
    const result = await staffLogin(value); assert.equal(result.status, 200); assert.equal(result.data.user.id, expected)
    const adminApi = await request('/api/admin/users', { token: result.data.token }); assert.equal(adminApi.status, 200)
  }
  const customer = await request('/api/auth/login', { body: { email: rt.customer.email, password } }); assert.equal(customer.status, 200)
  assert.equal((await request('/api/admin/users', { token: customer.data.token })).status, 403)
  assert.equal((await request('/api/auth/login', { body: { email: 'ADMIN1234', password } })).status, 400)
})
test('unknown identifiers, wrong passwords, unverified and customer accounts have uniform errors and rate limiting', async () => {
  const responses = [await staffLogin('unknown123'), await staffLogin('unknown@example.test'), await staffLogin('ad min'), await staffLogin(rt.customer.email), await request('/api/auth/staff-login', { body: { identifier: 'ADMIN1234', password: 'incorrect-password' } })]
  await db.user.update({ where: { id: rt.admin.id }, data: { verified: false } })
  responses.push(await staffLogin('ADMIN1234'))
  await db.user.update({ where: { id: rt.admin.id }, data: { verified: true } })
  for (const response of responses) { assert.equal(response.status, 401); assert.deepEqual(response.data, responses[0].data) }
  await staffLogin('unknown123'); await staffLogin('unknown123')
  assert.equal((await staffLogin('unknown123')).status, 429)
})
test('Google from panel and store returns to correct configured origin, conserves ADMIN and prevents code reuse', async () => {
  const count = await db.user.count()
  for (const app of ['panel', 'store']) {
    const flow = await start(app), response = await callback(flow)
    const location = new URL(response.location)
    assert.equal(location.origin, app === 'panel' ? panel : shop)
    assert.equal(location.pathname, '/auth/google/callback')
    assert.deepEqual([...location.searchParams.keys()], ['code'])
    const code = location.searchParams.get('code')
    // Proof and audience are both bound; failed attempts do not consume the right code.
    assert.equal((await exchange({ ...flow, verifier: randomBytes(32).toString('base64url') }, code, app)).status, 401)
    assert.equal((await exchange(flow, code, app === 'panel' ? 'store' : 'panel')).status, 401)
    const session = await exchange(flow, code, app)
    assert.equal(session.status, 200); assert.equal(session.data.user.id, rt.admin.id); assert.equal(session.data.user.role, 'ADMIN')
    assert.equal((await exchange(flow, code, app)).status, 401)
    assert.match((await callback(flow)).location, /googleError=state/)
  }
  assert.equal(await db.user.count(), count)
})
test('Google panel rejects customers and unknown accounts without creating or upgrading users', async () => {
  const count = await db.user.count()
  for (const profile of [customerProfile, { ...adminProfile, sub: 'new-identity', email: 'unknown@example.test' }]) {
    const result = await callback(await start('panel', profile))
    assert.equal(result.location, `${panel}/iniciar-sesion?googleError=access`)
  }
  assert.equal(await db.user.count(), count)
  const customer = await db.user.findUnique({ where: { id: rt.customer.id } })
  assert.equal(customer.role, 'CUSTOMER'); assert.equal(customer.googleId, null)
  const flow = await start('store', customerProfile), response = await callback(flow)
  assert.equal((await exchange(flow, new URL(response.location).searchParams.get('code'), 'store')).status, 200)
})
test('role is rechecked before exchange and in ADMIN API', async () => {
  const flow = await start(), result = await callback(flow), code = new URL(result.location).searchParams.get('code')
  const session = await staffLogin('ADMIN1234')
  await db.user.update({ where: { id: rt.admin.id }, data: { role: 'CUSTOMER' } })
  assert.equal((await exchange(flow, code)).status, 403)
  assert.equal((await staffLogin('ADMIN1234')).status, 401)
  assert.equal((await request('/api/admin/users', { token: session.data.token })).status, 403)
  await db.user.update({ where: { id: rt.admin.id }, data: { role: 'ADMIN' } })
})
test('state, cookie tampering, expiry, provider errors and external destinations fail closed', async () => {
  assert.equal((await request('/api/auth/google?app=https://evil.example.test')).status, 400)
  assert.equal((await request('/api/auth/google?app=panel&app=store')).status, 400)
  assert.throws(() => authFrontendOrigin('https://evil.example.test'))
  assert.throws(() => authFrontendOrigin('panel', { NODE_ENV: 'production', CORS_ORIGINS: shop }))
  const flow = await start(), original = providerCalls
  assert.match((await callback({ ...flow, cookie: flow.cookie + 'x' })).location, /googleError=state/)
  assert.match((await callback({ ...flow, state: randomBytes(32).toString('base64url') })).location, /googleError=state/)
  assert.equal(providerCalls, original)
  clock += OAUTH_TTL_MS + 1000
  assert.match((await callback(flow)).location, /googleError=state/)
  clock = Date.now()
  const denied = await start()
  const response = await request(`/api/auth/google/callback?state=${denied.state}&error=access_denied`, { cookie: denied.cookie })
  assert.equal(response.location, `${panel}/iniciar-sesion?googleError=denied`)
  const future = { CORS_ORIGINS: `${shop},https://admin.example.test`, PANEL_ORIGIN: 'https://admin.example.test' }
  assert.equal(authFrontendOrigin('panel', future), 'https://admin.example.test')
})
test('verified email recovery establishes password on Google account, keeps identity, invalidates sessions and consumes code once', async () => {
  const old = await staffLogin('ADMIN1234')
  await db.user.update({ where: { id: rt.admin.id }, data: { passwordHash: hash(randomBytes(32).toString('hex')) } })
  assert.equal((await staffLogin('ADMIN1234')).status, 401)
  assert.equal((await request('/api/auth/forgot-password', { body: { email: rt.admin.email } })).status, 202)
  for (let i = 0; i < 20 && !mails.length; i++) await new Promise(resolve => setTimeout(resolve, 10))
  const mail = mails.at(-1); assert.equal(mail.to, rt.admin.email)
  const body = { email: rt.admin.email, code: mail.code, newPassword: password }
  assert.equal((await request('/api/auth/reset-password', { body })).status, 200)
  assert.equal((await request('/api/auth/reset-password', { body })).status, 400)
  assert.equal((await request('/api/auth/me', { token: old.data.token })).status, 401)
  const user = await db.user.findUnique({ where: { id: rt.admin.id } })
  assert.equal(user.googleId, adminProfile.sub); assert.equal(user.role, 'ADMIN'); assert.equal(user.adminUsername, 'admin1234')
  assert.equal((await staffLogin('ADMIN1234')).status, 200)
  const flow = await start(), response = await callback(flow)
  assert.equal((await exchange(flow, new URL(response.location).searchParams.get('code'))).data.user.id, rt.admin.id)
})
