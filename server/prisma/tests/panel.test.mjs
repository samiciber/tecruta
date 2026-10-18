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
test('login real: ADMIN, CASHIER y WAREHOUSE; CUSTOMER rechazado en panel y válido en tienda', async () => {
  for (const user of [rt.admin, rt.cashier, rt.warehouse, rt.customer]) {
    const r = await request('/api/auth/staff-login', { user: null, method: 'POST', body: { email: user.email, password: 'Synthetic-panel-only-42' } })
    assert.equal(r.status, user.role === 'CUSTOMER' ? 403 : 200)
    assert.equal(Boolean(r.data.token), user.role !== 'CUSTOMER')
  }
  assert.equal((await request('/api/auth/login', { user: null, method: 'POST', body: { email: rt.customer.email, password: 'Synthetic-panel-only-42' } })).status, 200)
  for (const user of [null, rt.customer, rt.cashier, rt.warehouse]) assert.equal((await request('/api/admin/staff', { user })).status, user ? 403 : 401)
})
test('invitación individual, duplicados, activación privada y código de un uso', async () => {
  const body = { nombre: 'Trabajadora', apellido: 'Sintética', email: 'worker-panel@example.test', role: 'WAREHOUSE' }
  const r = await request('/api/admin/staff', { method: 'POST', body })
  assert.equal(r.status, 201); assert.equal(r.data.delivery, 'SENT'); assert.equal(r.data.user.verified, false)
  assert.equal(r.data.user.passwordHash, undefined); assert.equal(r.data.code, undefined)
  assert.equal((await request('/api/admin/staff', { method: 'POST', body })).status, 409)
  const stored = await rt.db.user.findUnique({ where: { email: body.email } })
  assert.equal(stored.resetCode, null); assert.ok(stored.resetCodeHash)
  const activation = mail.find(message => message.to === body.email)
  assert.equal(activation.activationUrl, local + '/recuperar-contrasena')
  const reset = { email: body.email, code: activation.code, newPassword: 'Private-synthetic-83' }
  assert.equal((await request('/api/auth/reset-password', { user: null, method: 'POST', body: reset })).status, 200)
  assert.equal((await request('/api/auth/reset-password', { user: null, method: 'POST', body: reset })).status, 400)
  const login = await request('/api/auth/staff-login', { user: null, method: 'POST', body: { email: body.email, password: reset.newPassword } })
  assert.equal(login.status, 200); assert.equal(login.data.user.role, 'WAREHOUSE')
  assert.equal((await request('/api/admin/staff/' + stored.id + '/activation', { method: 'POST' })).status, 409)
})
test('retirar acceso invalida sesiones y conserva la cuenta y el historial', async () => {
  const oldToken = rt.auth(rt.warehouse)
  const r = await request('/api/admin/staff/' + rt.warehouse.id + '/role', { method: 'PATCH', body: { role: 'CUSTOMER' } })
  assert.equal(r.status, 200)
  assert.equal((await request('/api/admin/inventory/products', { token: oldToken })).status, 401)
  assert.ok(await rt.db.user.findUnique({ where: { id: rt.warehouse.id } }))
  assert.equal((await request('/api/admin/staff/' + rt.admin.id + '/role', { method: 'PATCH', body: { role: 'CUSTOMER' } })).status, 409)
})
test('no se cambia acceso con caja abierta; el endpoint anterior también lo protege', async () => {
  const { openCash } = await rt.load('server/src/lib/posService.js')
  const { randomUUID } = await import('node:crypto')
  await openCash(rt.db, rt.cashier, { openingAmount: '0.00', requestId: randomUUID() })
  for (const path of ['/api/admin/staff/', '/api/admin/users/']) assert.equal((await request(path + rt.cashier.id + '/role', { method: 'PATCH', body: { role: 'CUSTOMER' } })).status, 409)
})
test('fallo de correo queda explícito y no simula activación ni entrega', async () => {
  mailFailure = true
  try {
    const r = await request('/api/admin/staff', { method: 'POST', body: { nombre: 'Pendiente', apellido: 'Sintético', email: 'qa-undelivered@example.test', role: 'CASHIER' } })
    assert.equal(r.status, 201); assert.equal(r.data.delivery, 'FAILED'); assert.equal(r.data.user.verified, false)
    assert.equal(mail.some(message => message.to === r.data.user.email), false)
    assert.equal((await request('/api/admin/staff/' + r.data.user.id + '/activation', { method: 'POST' })).status, 429)
  } finally { mailFailure = false }
})
test('un administrador autoriza otra cuenta ADMIN e invalida su sesión anterior', async () => {
  const before = await rt.db.user.findUnique({ where: { id: rt.customer.id } })
  const oldToken = rt.auth(before)
  const r = await request('/api/admin/staff/' + before.id + '/role', { method: 'PATCH', body: { role: 'ADMIN' } })
  assert.equal(r.status, 200); assert.equal(r.data.role, 'ADMIN')
  assert.equal((await request('/api/admin/staff', { token: oldToken })).status, 401)
  const login = await request('/api/auth/staff-login', { user: null, method: 'POST', body: { email: before.email, password: 'Synthetic-panel-only-42' } })
  assert.equal(login.status, 200)
  assert.equal((await request('/api/admin/staff', { token: login.data.token })).status, 200)
})
