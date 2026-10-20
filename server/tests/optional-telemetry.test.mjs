import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizedError, reportError, sentryEndpoint } from '../src/optional/errorMonitor.js'
import { analyticsPayload, reportAnalytics } from '../src/optional/analytics.js'

test('monitoreo apagado/inválido no llama al proveedor y elimina todos los datos libres', async () => {
  let calls = 0
  for (const dsn of [undefined, '', 'http://example.test', 'https://key:secret@example.test/1']) {
    assert.equal(await reportError(new Error('qa@example.test token=synthetic payment=1234'), { dsn, send: async () => { calls++; return { ok: true } } }), false)
  }
  assert.equal(calls, 0)
  const value = sanitizedError({ name: 'TypeError', message: 'qa@example.test', stack: 'Bearer synthetic', body: { password: 'synthetic' }, headers: { Authorization: 'synthetic' } })
  assert.deepEqual(value, { platform: 'node', level: 'error', message: 'TecRuta backend: TypeError', tags: { source: 'backend', category: 'TypeError' } })
  assert.equal(sanitizedError({ name: 'private freeform name' }).tags.category, 'Error')
})

test('envelope mínimo con DSN explícito, límite de volumen y fallo aislado', async () => {
  const dsn = 'https://' + 'a'.repeat(32) + '@o0.ingest.sentry.io/0'
  assert.equal(sentryEndpoint(dsn), 'https://o0.ingest.sentry.io/api/0/envelope/')
  let calls = 0
  const send = async (url, options) => {
    calls++
    const [head, item, event] = options.body.trim().split('\n').map(JSON.parse)
    assert.match(head.event_id, /^[a-f0-9]{32}$/)
    assert.equal(item.type, 'event')
    assert.equal(event.message, 'TecRuta frontend: Error')
    assert.equal(options.body.includes('qa@example.test'), false)
    assert.equal(options.redirect, 'error')
    return { ok: true }
  }
  const options = { dsn, source: 'frontend', send, now: 1900000000000 }
  for (let i = 0; i < 31; i++) await reportError({ message: 'qa@example.test' }, options)
  assert.equal(calls, 30)
  assert.equal(await reportError({}, { ...options, now: options.now + 61000, send: async () => { throw Error('Synthetic unavailable') } }), false)
})

test('analítica solo acepta eventos conocidos, no añade PII y no envía sin configuración', async () => {
  let calls = 0
  const send = async (url, options) => {
    calls++
    assert.equal(url, 'https://analytics.example.test/api/event')
    assert.deepEqual(JSON.parse(options.body), { name: 'Agregar al carrito', domain: 'shop.example.test', url: 'https://shop.example.test/tienda' })
    assert.deepEqual(Object.keys(options.headers).sort(), ['Content-Type', 'User-Agent'])
    return { ok: true }
  }
  assert.equal(await reportAnalytics('pageview', { env: {}, send }), false)
  assert.equal(analyticsPayload('qa@example.test', 'shop.example.test'), null)
  assert.equal(analyticsPayload('pageview', 'evil.example/path?token=qa'), null)
  const env = { PLAUSIBLE_ENDPOINT: 'https://analytics.example.test/api/event', PLAUSIBLE_DOMAIN: 'shop.example.test' }
  assert.equal(await reportAnalytics('Agregar al carrito', { env, send }), true)
  assert.equal(calls, 1)
  assert.equal(await reportAnalytics('pageview', { env: { ...env, PLAUSIBLE_ENDPOINT: 'http://127.0.0.1/api/event' }, send }), false)
  assert.equal(await reportAnalytics('pageview', { env, send: async () => { throw Error('Offline') } }), false)
})
