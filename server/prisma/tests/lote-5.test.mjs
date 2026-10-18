import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import bcrypt from '../../node_modules/bcryptjs/index.js'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'

const password = randomBytes(24).toString('hex')
let rt, db, base, token
async function request(path, { method = 'GET', body, authenticated = false } = {}) {
  const response = await fetch(base + '/api/' + path, { method, headers: {
    'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  return { status: response.status, data: await response.json().catch(() => null) }
}
before(async () => {
  process.env.CORS_ORIGIN = 'https://qa.example.invalid'
  process.env.TRUST_PROXY = '1'
  process.env.NODE_ENV = 'production'
  for (const key of ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) process.env[key] = ''
  rt = await createInventoryRuntime()
  db = rt.db
  await db.category.create({ data: { id: 'qa-category', name: 'QA category', slug: 'qa-category', legacy: true } })
  await db.brand.create({ data: { id: 'qa-brand', name: 'QA brand', slug: 'qa-brand' } })
  // The fixture uses the same central stock mechanism as the product editor.
  const { createAdminProduct } = await rt.load('server/src/lib/adminProducts.js')
  await createAdminProduct(db, { id: 'qa-product', name: 'QA product', slug: 'qa-product', brand: 'QA brand', brandId: 'qa-brand', category: 'qa-category', price: '19.90', stock: 3, stockReason: 'Synthetic opening balance', tags: ['qa'] }, rt.admin.id)
  await db.user.create({ data: { id: 'qa-customer', email: 'qa-customer@example.invalid', passwordHash: await bcrypt.hash(password, 10), nombre: 'QA', apellido: 'Customer', verified: true } })
  base = await rt.start()
})
after(async () => { await rt?.close() })

test('updated Express/Prisma serves catalog filters and detail from disposable Postgres', async () => {
  for (const path of ['products', 'products?category=qa-category', 'products?brand=qa-brand', 'products?q=QA']) {
    const result = await request(path)
    assert.equal(result.status, 200)
    assert.equal(result.data.length, 1)
    assert.equal(result.data[0].id, 'qa-product')
    assert.equal(result.data[0].price, 19.9)
  }
  assert.equal((await request('products/qa-product')).data.stock, 3)
  assert.equal((await request('products/qa-absent')).status, 404)
})
test('public navigation, category and payment routes retain their contracts', async () => {
  for (const path of ['categories', 'categories/tree', 'brands', 'nav', 'popular-searches', 'stores', 'site-settings', 'payment-methods']) {
    const result = await request(path)
    assert.equal(result.status, 200, path)
    assert.ok(result.data !== null, path)
  }
})
test('login and profile work, customer admin access is forbidden, private collections require auth', async () => {
  const result = await request('auth/login', { method: 'POST', body: { email: 'qa-customer@example.invalid', password } })
  assert.equal(result.status, 200)
  token = result.data.token
  assert.ok(typeof token === 'string')
  assert.equal((await request('auth/me', { authenticated: true })).data.user.id, 'qa-customer')
  assert.equal((await request('admin/products', { authenticated: true })).status, 403)
  for (const path of ['cart', 'saved', 'addresses', 'orders/me']) assert.equal((await request(path)).status, 401, path)
  for (const path of ['cart', 'saved', 'addresses', 'orders/me']) assert.equal((await request(path, { authenticated: true })).status, 200, path)
  // Only this disposable fixture changes role; no production user is involved.
  await db.user.update({ where: { id: 'qa-customer' }, data: { role: 'ADMIN' } })
  const admin = await request('admin/dashboard', { authenticated: true })
  assert.equal(admin.status, 200)
  assert.equal(admin.data.stock.low, 1)
})
test('login rate limiting uses separate forwarded client IPs behind one proxy', async () => {
  const attempt = ip => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email: 'qa-absent@example.invalid', password }) })
  for (let i = 0; i < 8; i++) assert.equal((await attempt('192.0.2.80')).status, 401)
  assert.equal((await attempt('192.0.2.80')).status, 429)
  assert.equal((await attempt('192.0.2.81')).status, 401)
})
