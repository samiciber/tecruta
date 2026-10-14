import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { generateCode, codeHash, equalHash, googleIdentity, challenge, signFlowCookie, readFlowCookie, hash } from '../server/src/lib/authSecurity.js'
import { browserStores, readSessionToken, saveSessionToken, clearSessionToken, shouldClearSession } from '../src/services/sessionStorage.js'
import { prepareGoogleFlow, readGoogleFlow, clearGoogleFlow } from '../src/services/googleFlow.js'

process.env.JWT_SECRET = randomBytes(32).toString('hex')
process.env.NODE_ENV = 'test'
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/api/auth/google/callback'
function store() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
test('six-digit codes use keyed hashes scoped by account and purpose', () => {
  const code = generateCode()
  assert.ok(/^\d{6}$/.test(code))
  const digest = codeHash('qa-a', 'verify', code)
  assert.ok(equalHash(digest, codeHash('qa-a', 'verify', code)))
  assert.ok(!equalHash(digest, codeHash('qa-b', 'verify', code)))
  assert.ok(!equalHash(digest, codeHash('qa-a', 'reset', code)))
  assert.ok(!equalHash(digest, code))
  assert.ok(digest !== hash(code))
})
test('Google identity requires a nonempty sub and strictly verified email', () => {
  const profile = { sub: 'qa-sub', email: ' QA@Example.Invalid ', email_verified: true }
  assert.equal(googleIdentity(profile).email, 'qa@example.invalid')
  for (const change of [{ sub: undefined }, { sub: '' }, { sub: 1 }, { email_verified: 'true' }, { email_verified: false }, { email: 'invalid' }]) {
    assert.throws(() => googleIdentity({ ...profile, ...change }), error => error.status === 403)
  }
})
test('flow cookie binds state and verifier, rejects tampering and duplicate cookies', () => {
  const binding = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url')
  const cookie = signFlowCookie({ binding, verifier, stateHash: hash('qa-state') })
  const valid = readFlowCookie('tecruta-oauth=' + cookie)
  assert.ok(valid?.binding === binding && valid?.verifier === verifier)
  assert.ok(!readFlowCookie('tecruta-oauth=' + cookie + 'x'))
  assert.ok(!readFlowCookie('tecruta-oauth=' + cookie + '; tecruta-oauth=' + cookie))
})
test('remember choice uses exactly one storage and logout clears both', () => {
  const local = store(), session = store(), token = randomBytes(32).toString('hex')
  saveSessionToken(local, session, token, true)
  assert.ok(readSessionToken(local, session) === token)
  assert.ok(local.getItem('tecruta:token') !== null && session.getItem('tecruta:token') === null)
  saveSessionToken(local, session, token, false)
  assert.ok(local.getItem('tecruta:token') === null && session.getItem('tecruta:token') !== null)
  clearSessionToken(local, session)
  assert.ok(readSessionToken(local, session) === null)
})
test('blocked storage does not claim that a login preference was saved', () => {
  const local = store(), blocked = { setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
  assert.throws(() => saveSessionToken(local, blocked, randomBytes(32).toString('hex'), false))
  assert.ok(local.getItem('tecruta:token') === null)
  const browser = { get localStorage() { throw new Error('blocked') }, get sessionStorage() { throw new Error('blocked') } }
  const fallback = browserStores(browser)
  assert.equal(readSessionToken(fallback.local, fallback.session), null)
  assert.throws(() => saveSessionToken(fallback.local, fallback.session, randomBytes(32).toString('hex'), true))
})
test('only 401 invalidates session; network, 403, 429 and 5xx keep it', () => {
  assert.ok(shouldClearSession({ status: 401 }))
  for (const status of [undefined, 403, 429, 500, 503]) assert.ok(!shouldClearSession({ status }))
})
test('per-tab Google proof yields S256 challenge and preserves remember choice', async () => {
  const session = store()
  const result = await prepareGoogleFlow(session, false)
  const proof = readGoogleFlow(session)
  assert.ok(proof && result === challenge(proof.verifier) && proof.remember === false)
  clearGoogleFlow(session)
  assert.ok(readGoogleFlow(session) === null)
})
