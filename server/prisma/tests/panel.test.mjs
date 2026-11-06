import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
import { corsOrigins, validateRuntimeEnv, storeOrigin } from '../../src/lib/runtimeConfig.js'
import { safePanelReturn, legacyPanelPath, apiBase } from '../../../src/app/urls.js'

let rt, base, bcrypt, mailFailure = false
const mail = []
const local = 'http://127.0.0.1:5180'
const shop = 'http://127.0.0.1:5173'
process.env.CORS_ORIGINS = `${shop},${local}`
process.env.STORE_ORIGIN = shop
process.env.PANEL_ORIGIN = local
async function request(path, { user = rt.admin, token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token || user ? { Authorization: 'Bearer ' + (token || rt.auth(user)) } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, headers: response.headers, data: await response.json().catch(() => null) }
}
before(async () => {
  rt = await createInventoryRuntime({ appOptions: async runtime => {
    const { pathToFileURL } = await import('node:url')
    const { join } = await import('node:path')
    const load = p => import(pathToFileURL(join(runtime.root, p)))
    const { createAuthRouter } = await load('server/src/routes/auth.routes.js')
    const { createStaffRouter } = await load('server/src/routes/staff.routes.js')
    const capture = async message => { if (mailFailure) throw new Error('Proveedor sintético no disponible'); mail.push(message) }
    return { auth: createAuthRouter({ db: runtime.db, mailer: { reset: capture, verification: capture } }), staff: createStaffRouter({ db: runtime.db, mailer: capture }) }
  } })
  bcrypt = (await rt.load('server/node_modules/bcryptjs/index.js')).default
  await rt.db.user.updateMany({ data: { passwordHash: await bcrypt.hash('Synthetic-panel-only-42', 10) } })
  base = await rt.start()
})
after(async () => { await rt?.close() })

test('CORS: dos orígenes explícitos, OPTIONS y rechazo de origen ajeno', async () => {
  for (const origin of [shop, local]) {
    const r = await request('/api/admin/staff', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,idempotency-key' } })
    assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), origin)
    assert.match(r.headers.get('access-control-allow-headers'), /authorization/i)
  }
  const r = await request('/api/health', { user: null, headers: { Origin: 'https://outside.example.test' } })
  assert.equal(r.headers.get('access-control-allow-origin'), null)
  assert.deepEqual(corsOrigins({ CORS_ORIGIN: shop }), [shop])
  for (const value of ['*', 'https://x.test/path', 'https://user:pass@x.test', 'https://x.test,', 'https://x.test/']) assert.throws(() => corsOrigins({ CORS_ORIGINS: value }))
  validateRuntimeEnv({ NODE_ENV: 'production', JWT_SECRET: 'synthetic', DATABASE_URL: 'postgresql://qa@localhost/qa', CORS_ORIGINS: `${shop},${local}`, STORE_ORIGIN: shop, PANEL_ORIGIN: local })
  assert.equal(storeOrigin({ CORS_ORIGINS: `${shop},${local}`, STORE_ORIGIN: shop }), shop)
})
test('retornos seguros y URL de API sin prefijo duplicado', () => {
  for (const unsafe of ['https://outside.test', '//outside.test', '/\\outside.test', '/iniciar-sesion', '/admin/iniciar-sesion', '/admin//outside.test', '/a/../iniciar-sesion', '/%2f%2foutside.test', '/auth/google/callback', '/\nhttps://outside.test']) assert.equal(safePanelReturn(unsafe, '/inventario'), '/inventario')
  assert.equal(safePanelReturn('/admin/home-layout?x=1#editor'), '/home-layout?x=1#editor')
  assert.equal(legacyPanelPath('/admin'), '/')
  assert.equal(apiBase('https://api.example.test/api/'), 'https://api.example.test')
})
test('login real: ADMIN, CASHIER y WAREHOUSE por usuario; CUSTOMER rechazado en panel y válido en tienda', async () => {
  // El panel entra únicamente con usuario (alias); se asigna uno a cada cuenta staff.
  await rt.db.user.update({ where: { id: rt.admin.id }, data: { adminUsername: 'qaadmin01' } })
  await rt.db.user.update({ where: { id: rt.cashier.id }, data: { adminUsername: 'qacash01' } })
  await rt.db.user.update({ where: { id: rt.warehouse.id }, data: { adminUsername: 'qawareh01' } })
  for (const alias of ['qaadmin01', 'qacash01', 'qawareh01']) {
    const r = await request('/api/auth/staff-login', { user: null, method: 'POST', body: { identifier: alias, password: 'Synthetic-panel-only-42' } })
    assert.equal(r.status, 200); assert.ok(r.data.token)
  }
  assert.equal((await request('/api/auth/staff-login', { user: null, method: 'POST', body: { identifier: 'noexiste', password: 'Synthetic-panel-only-42' } })).status, 401)
  assert.equal((await request('/api/auth/login', { user: null, method: 'POST', body: { email: rt.customer.email, password: 'Synthetic-panel-only-42' } })).status, 200)
  for (const user of [null, rt.customer, rt.cashier, rt.warehouse]) assert.equal((await request('/api/admin/staff', { user })).status, user ? 403 : 401)
})
test('creación por usuario con contraseña temporal, duplicados y suspensión', async () => {
  const body = { username: 'workerqa', nombre: 'Trabajadora', apellido: 'Sintética', role: 'WAREHOUSE', temporaryPassword: 'Temporal-qa-123' }
  const r = await request('/api/admin/staff', { method: 'POST', body })
  assert.equal(r.status, 201); assert.equal(r.data.username, 'workerqa'); assert.equal(r.data.mustChangePassword, true)
  assert.equal((await request('/api/admin/staff', { method: 'POST', body })).status, 409)
  const login = await request('/api/auth/staff-login', { user: null, method: 'POST', body: { identifier: 'workerqa', password: 'Temporal-qa-123' } })
  assert.equal(login.status, 200); assert.equal(login.data.user.role, 'WAREHOUSE')
  assert.equal((await request('/api/auth/staff-login', { user: null, method: 'POST', body: { identifier: 'workerqa', password: 'incorrecta' } })).status, 401)
  const suspended = await request('/api/admin/staff/' + login.data.user.id, { method: 'PATCH', body: { isSuspended: true, reason: 'QA suspensión temporal' } })
  assert.equal(suspended.status, 200); assert.equal(suspended.data.isSuspended, true)
  assert.equal((await request('/api/auth/staff-login', { user: null, method: 'POST', body: { identifier: 'workerqa', password: 'Temporal-qa-123' } })).status, 401)
})
test('cambios de acceso validan rol, motivo y no permiten modificarse a uno mismo', async () => {
  assert.equal((await request('/api/admin/staff/' + rt.cashier.id, { method: 'PATCH', body: { role: 'CUSTOMER', reason: 'QA motivo inválido' } })).status, 400)
  assert.equal((await request('/api/admin/staff/' + rt.cashier.id, { method: 'PATCH', body: { role: 'ADMIN', reason: 'qa' } })).status, 400)
  assert.equal((await request('/api/admin/staff/' + rt.admin.id, { method: 'PATCH', body: { isSuspended: true, reason: 'QA no puede auto-suspenderse' } })).status, 409)
})
test('la auditoría registra creaciones y cambios de acceso', async () => {
  const audit = await request('/api/admin/staff/audit')
  assert.equal(audit.status, 200); assert.ok(audit.data.total >= 2)
  assert.ok(audit.data.items.some(item => item.action === 'STAFF_CREATED'))
})
