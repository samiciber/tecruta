import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeparationRuntime } from './helpers/separation-runtime.mjs'
import { corsOrigins, validateRuntimeEnv } from '../../src/lib/runtimeConfig.js'
import { safePanelReturn } from '../../../src/app/urls.js'

test('exact CORS configuration and panel return destinations', () => {
  const env = { CORS_ORIGINS: 'https://www.tecruta.com,https://tecruta-panel.vercel.app', STORE_ORIGIN: 'https://www.tecruta.com' }
  assert.deepEqual(corsOrigins(env), ['https://www.tecruta.com', 'https://tecruta-panel.vercel.app'])
  validateRuntimeEnv(env)
  for (const value of ['*', 'https://*.vercel.app', 'https://panel.invalid/path', 'https://panel.invalid,']) assert.throws(() => corsOrigins({ CORS_ORIGINS: value }))
  assert.throws(() => validateRuntimeEnv({ ...env, PANEL_ORIGIN: 'https://other.invalid' }))
  for (const value of ['//evil.invalid', 'https://evil.invalid', '/\\evil.invalid', '/inventario', '/pos', '/usuarios']) assert.equal(safePanelReturn(value), '/')
  assert.equal(safePanelReturn('/admin/productos?pagina=2#editar'), '/productos?pagina=2#editar')
})

test('real API: both origins and ADMIN permissions work without inventory or POS migrations', async () => {
  process.env.CORS_ORIGINS = 'https://www.tecruta.com,https://tecruta-panel.vercel.app'
  process.env.STORE_ORIGIN = 'https://www.tecruta.com'
  const rt = await createSeparationRuntime()
  try {
    const base = await rt.start()
    for (const origin of corsOrigins()) {
      const response = await fetch(base + '/api/admin/products', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } })
      assert.equal(response.status, 204)
      assert.equal(response.headers.get('access-control-allow-origin'), origin)
    }
    for (const origin of ['https://another.vercel.app', 'https://tecruta-panel.vercel.app.evil.invalid']) {
      const response = await fetch(base + '/api/health', { headers: { Origin: origin } })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('access-control-allow-origin'), null)
    }
    const login = async email => {
      const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: rt.password }) })
      assert.equal(response.status, 200)
      return (await response.json()).token
    }
    const admin = await login(rt.admin.email), customer = await login(rt.customer.email)
    for (const path of ['/api/admin/orders', '/api/admin/dashboard', '/api/admin/home-layout', '/api/admin/users']) {
      assert.equal((await fetch(base + path)).status, 401)
      assert.equal((await fetch(base + path, { headers: { Authorization: `Bearer ${customer}` } })).status, 403)
      assert.equal((await fetch(base + path, { headers: { Authorization: `Bearer ${admin}` } })).status, 200, path)
    }
    const original = await rt.db.siteSetting.findUnique({ where: { key: 'announcement' } })
    assert.equal(original, null)
    assert.equal(await rt.db.product.count(), 0)
    assert.equal((await fetch(base + '/api/pos/config')).status, 404)
    assert.equal((await fetch(base + '/api/admin/inventory/summary', { headers: { Authorization: `Bearer ${admin}` } })).status, 404)
    const migrations = await rt.db.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY migration_name`
    assert.equal(migrations.some(row => /inventory|pos_part/.test(row.migration_name)), false)
  } finally { await rt.close() }
})
