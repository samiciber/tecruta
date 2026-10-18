import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import express from '../node_modules/express/index.js'
import { validateRuntimeEnv } from '../src/lib/runtimeConfig.js'

// Synthetic configuration only. dotenv cannot load a developer's .env.
process.env.DOTENV_CONFIG_PATH = '/dev/null'
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'qa-synthetic-secret-not-for-deployment'
process.env.DATABASE_URL = 'postgresql://qa@127.0.0.1:1/qa'
process.env.CORS_ORIGIN = 'https://qa.example.invalid'
process.env.TRUST_PROXY = '1'
const valid = { ...process.env, NODE_ENV: 'production' }
const { createApp } = await import('../src/index.js')

test('production reports every missing variable by name without leaking other values', () => {
  for (const name of ['JWT_SECRET', 'DATABASE_URL', 'CORS_ORIGIN']) {
    assert.throws(() => validateRuntimeEnv({ ...valid, [name]: '  ' }), error => {
      assert.ok(error.message.includes(name))
      assert.ok(!error.message.includes(valid.JWT_SECRET))
      assert.ok(!error.message.includes(valid.DATABASE_URL))
      return true
    })
  }
  assert.doesNotThrow(() => validateRuntimeEnv({ NODE_ENV: 'development' }))
  assert.doesNotThrow(() => validateRuntimeEnv(valid))
  assert.throws(() => validateRuntimeEnv({ ...valid, JWT_SECRET: 'REPLACE_WITH_A_LONG_RANDOM_SECRET' }), /JWT_SECRET/)
})
test('production rejects malformed database URLs and CORS paths, lists and credentials', () => {
  for (const DATABASE_URL of ['https://qa.invalid/database', 'postgresql://localhost', 'not-a-url']) {
    assert.throws(() => validateRuntimeEnv({ ...valid, DATABASE_URL }), /DATABASE_URL/)
  }
  for (const CORS_ORIGIN of ['*', 'https://qa.invalid/', 'https://qa.invalid/path', 'https://a.invalid,https://b.invalid', 'https://qa:password@qa.invalid', '//qa.invalid']) {
    assert.throws(() => validateRuntimeEnv({ ...valid, CORS_ORIGIN }), /CORS_ORIGIN/)
  }
})
test('actual production entry point fails before listening when required configuration is missing', () => {
  assert.throws(() => execFileSync(process.execPath, ['src/index.js'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', stdio: 'pipe', timeout: 10000,
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', DATABASE_URL: '', CORS_ORIGIN: '', PORT: '0' },
  }), error => {
    assert.equal(error.status, 1)
    assert.match(error.stderr, /Configuración de producción incompleta: JWT_SECRET, DATABASE_URL, CORS_ORIGIN/)
    assert.equal(error.stdout, '')
    return true
  })
})
test('proxy default is one hop; only bounded integers are accepted', () => {
  const previous = process.env.TRUST_PROXY
  try {
    delete process.env.TRUST_PROXY
    assert.equal(createApp().get('trust proxy'), 1)
    for (const value of ['0', '1', '2', '5']) {
      process.env.TRUST_PROXY = value
      assert.equal(createApp().get('trust proxy'), Number(value))
    }
    for (const value of ['true', '-1', '6', '1.5', 'loopback']) {
      process.env.TRUST_PROXY = value
      assert.throws(() => createApp(), /TRUST_PROXY/)
    }
  } finally { process.env.TRUST_PROXY = previous }
})
async function withApp(run, app = createApp()) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise(resolve => server.close(resolve)) }
}
test('deployment maintenance blocks reads and writes without invalidating sessions; health stays available', async () => {
  const previous = process.env.MAINTENANCE_MODE
  process.env.MAINTENANCE_MODE = 'true'
  try {
    await withApp(async base => {
      const health = await fetch(base + '/api/health')
      assert.equal(health.status, 200)
      assert.equal((await health.json()).maintenance, true)
      for (const [method, path] of [['GET', '/api/products'], ['POST', '/api/orders'], ['PATCH', '/api/admin/users/test/role'], ['POST', '/api/auth/login']]) {
        const response = await fetch(base + path, { method })
        assert.equal(response.status, 503)
        assert.equal(response.headers.get('cache-control'), 'no-store')
        assert.equal(response.headers.get('retry-after'), '120')
        assert.equal((await response.json()).maintenance, true)
      }
      process.env.MAINTENANCE_MODE = 'false'
      assert.equal((await fetch(base + '/api/auth/me')).status, 401)
    })
  } finally { if (previous === undefined) delete process.env.MAINTENANCE_MODE; else process.env.MAINTENANCE_MODE = previous }
})
test('health, denied admin and unknown routes have API CSP, nosniff and no X-Powered-By', async () => {
  await withApp(async base => {
    for (const [path, status] of [['/api/health', 200], ['/api/admin/products', 401], ['/api/qa-unknown', 404]]) {
      const response = await fetch(base + path)
      assert.equal(response.status, status)
      assert.equal(response.headers.get('x-powered-by'), null)
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert.equal(response.headers.get('x-frame-options'), 'DENY')
      assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin')
      assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
      assert.match(response.headers.get('content-type'), /application\/json/)
    }
  })
})
test('CORS allows the configured SPA and bearer preflights, without authorizing another origin', async () => {
  await withApp(async base => {
    const response = await fetch(base + '/api/auth/me', { method: 'OPTIONS', headers: {
      Origin: process.env.CORS_ORIGIN,
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'authorization,content-type',
    } })
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), process.env.CORS_ORIGIN)
    assert.match(response.headers.get('access-control-allow-methods'), /PATCH/)
    assert.match(response.headers.get('access-control-allow-headers'), /authorization/)
    assert.equal(response.headers.get('access-control-allow-credentials'), null)
    const denied = await fetch(base + '/api/health', { headers: { Origin: 'https://other.invalid' } })
    assert.notEqual(denied.headers.get('access-control-allow-origin'), 'https://other.invalid')
  })
})
test('forwarded address chain respects the configured hop count', async () => {
  const previous = process.env.TRUST_PROXY
  try {
    for (const [hops, expected] of [['0', '127.0.0.1'], ['1', '192.0.2.2'], ['2', '192.0.2.1']]) {
      process.env.TRUST_PROXY = hops
      const orders = express.Router().get('/qa-proxy', (req, res) => res.json({ ip: req.ip }))
      await withApp(async base => {
        const response = await fetch(base + '/api/orders/qa-proxy', { headers: { 'X-Forwarded-For': '198.51.100.123, 192.0.2.1, 192.0.2.2' } })
        assert.equal((await response.json()).ip, expected)
      }, createApp({ orders }))
    }
  } finally { process.env.TRUST_PROXY = previous }
})
test('HSTS is enabled for production API only, with no preload or subdomain commitment', async () => {
  try {
    process.env.NODE_ENV = 'production'
    await withApp(async base => {
      const response = await fetch(base + '/api/health')
      assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000')
    })
  } finally { process.env.NODE_ENV = 'test' }
})
