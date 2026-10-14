// Run after merging Lote 2: node --test server/prisma/tests/lote-3.test.mjs
// Only loopback PostgreSQL/API and synthetic records. Cloudinary is replaced.
import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createEmptyDotenv, createPrismaWorkspace, runDocker, runPrisma } from './helpers/isolated-runtime.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const history = process.env.TECRUTA_QA_MIGRATIONS_DIR || join(root, 'server/prisma/migrations')
const migration = '20261012000001_add_order_receipt_token_idempotency'
const nav = '20261012000000_add_nav_brands_stores_saved_items'
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
const container = `tecruta-lote3-test-${process.pid}`
const temp = mkdtempSync(join(tmpdir(), 'tecruta-lote3-'))
const dotenvPath = createEmptyDotenv(temp)
const schema = join(root, 'server/prisma/schema.prisma')
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
let workspace, started, server, db, base, tokens, createLimit, receiptLimit
let uploads = 0
function docker(...args) { return runDocker(args) }
function sql(database, input) { return runDocker(['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'qa_lote3', '-d', database], { input }).trim() }
function prismaWithUrl(databaseUrl, ...args) {
  const sandboxedArgs = [...args]
  if (!sandboxedArgs.includes('--schema')) sandboxedArgs.push('--schema', workspace.schemaPath)
  return runPrisma({ root, tempRoot: temp, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl, args: sandboxedArgs })
}
function prisma(...args) { return prismaWithUrl(process.env.DATABASE_URL, ...args) }
function expectedMigrations() {
  return readdirSync(workspace.migrationsPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(workspace.migrationsPath, entry.name, 'migration.sql')))
    .map(entry => entry.name)
    .sort()
}
async function request(path, { method = 'GET', body, token, key, capability, headers } = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
    ...(capability ? { 'X-Receipt-Token': capability } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json() }
}
const bodyFor = (items) => ({ customer: { nombre: 'QA', apellido: 'Example', correo: 'qa@example.invalid', celular: '000000000' },
  delivery: { tipoEntrega: 'envio', departamento: 'QA', provincia: 'QA', distrito: 'QA', direccion: 'Fictitious', numero: '0' }, paymentMethod: 'qa-payment', items })
async function product(stock, price = '9.99') {
  const id = randomUUID()
  return db.product.create({ data: { id, slug: id, name: 'QA product', categoryId: 'qa-category', price, compareAtPrice: '12.99', stock, tags: [] } })
}
const create = (body, options = {}) => request('/api/orders', { method: 'POST', body, key: randomUUID(), ...options })

before(async () => {
  assert.ok(existsSync(join(history, nav, 'migration.sql')), 'Merge PR #3 first, or stage its unchanged migration with TECRUTA_QA_MIGRATIONS_DIR')
  docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=qa_lote3', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image)
  started = true
  const connection = `postgresql://qa_lote3@${docker('port', container, '5432/tcp')}`
  process.env.DATABASE_URL = `${connection}/qa_orders`
  process.env.JWT_SECRET = 'qa-disposable-only-not-a-production-secret'
  process.env.TRUST_PROXY = '0'
  process.env.CORS_ORIGIN = 'http://qa.invalid'
  process.env.DOTENV_CONFIG_PATH = dotenvPath
  let ready = false
  for (let i = 0; i < 40; i++) {
    try { sql('postgres', 'SELECT 1;'); ready = true; break } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready)
  sql('postgres', 'CREATE DATABASE qa_orders; CREATE DATABASE qa_shadow; CREATE DATABASE qa_fresh;')
  workspace = createPrismaWorkspace({ tempRoot: temp, name: 'prisma', schemaSource: schema, migrationsSource: history, excludedMigrations: [migration] })
  prisma('migrate', 'deploy', '--schema', workspace.schemaPath)
  sql('qa_orders', `
    INSERT INTO categories (id, slug, name) VALUES ('qa-category', 'qa-category', 'QA category');
    INSERT INTO users (id, email, "passwordHash", nombre, apellido, role, "updatedAt") VALUES
      ('qa-a', 'qa-a@example.invalid', 'not-a-real-hash', 'QA', 'A', 'CUSTOMER', '2026-01-01'),
      ('qa-b', 'qa-b@example.invalid', 'not-a-real-hash', 'QA', 'B', 'CUSTOMER', '2026-01-01'),
      ('qa-admin', 'qa-admin@example.invalid', 'not-a-real-hash', 'QA', 'Admin', 'ADMIN', '2026-01-01');
    INSERT INTO payment_methods (id, key, label, config) VALUES ('qa-payment', 'qa-payment', 'QA payment', '{}');
    INSERT INTO orders (id, "customerNombre", "customerApellido", "customerCorreo", "customerCelular", "deliveryType", departamento, provincia, distrito, subtotal, total, "updatedAt", "receiptUrl")
    VALUES ('qa-old-order', 'QA', 'Old', 'qa-old@example.invalid', '000000000', 'SHIPPING', 'QA', 'QA', 'QA', 123.45, 123.45, '2026-01-01', '/qa-existing.pdf');
  `)
  cpSync(join(history, migration), join(workspace.migrationsPath, migration), { recursive: true })
  prisma('migrate', 'deploy', '--schema', workspace.schemaPath)
  const { prisma: client } = await import('../../src/lib/prisma.js')
  db = client
  const { signToken } = await import('../../src/lib/token.js')
  tokens = Object.fromEntries(['a', 'b', 'admin'].map(role => [role, signToken({ sub: `qa-${role}` })]))
  const { createOrdersRouter } = await import('../../src/routes/orders.routes.js')
  const { createAdminRouter } = await import('../../src/routes/admin.routes.js')
  const limits = await import('../../src/middleware/orderLimits.js')
  createLimit = limits.createOrderLimit; receiptLimit = limits.receiptLimit
  const { createApp } = await import('../../src/index.js')
  const fakeUpload = async () => { uploads++; return 'https://qa-upload.invalid/qa.png' }
  server = createApp({ orders: createOrdersRouter({ uploadReceipt: fakeUpload }),
    admin: createAdminRouter({ uploadImage: fakeUpload, uploadModel: fakeUpload }) }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
beforeEach(() => { createLimit?.resetKey('127.0.0.1'); receiptLimit?.resetKey('127.0.0.1') })
after(async () => {
  try {
    if (server) await new Promise(resolve => server.close(resolve))
    if (db) await db.$disconnect()
  } finally {
    try { if (started) docker('rm', '--force', '--volumes', container) }
    finally { rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) }
  }
})

test('nullable migration preserves old orders; all integrated migrations reproduce schema from zero and history', async () => {
  const old = await db.order.findUnique({ where: { id: 'qa-old-order' } })
  assert.equal(Number(old.total), 123.45); assert.equal(old.receiptUrl, '/qa-existing.pdf')
  for (const key of ['receiptTokenHash', 'idempotencyKey', 'requestHash']) assert.equal(old[key], null)
  assert.match(prisma('migrate', 'diff', '--from-schema-datasource', workspace.schemaPath, '--to-schema-datamodel', workspace.schemaPath, '--script', '--exit-code'), /empty migration/)
  assert.match(prisma('migrate', 'diff', '--from-migrations', workspace.migrationsPath, '--to-schema-datamodel', workspace.schemaPath,
    '--shadow-database-url', process.env.DATABASE_URL.replace('/qa_orders', '/qa_shadow'), '--script', '--exit-code'), /empty migration/)
  prismaWithUrl(process.env.DATABASE_URL.replace('/qa_orders', '/qa_fresh'), 'migrate', 'deploy', '--schema', workspace.schemaPath)
  const freshHistory = sql('qa_fresh', 'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;')
  const appliedMigrations = freshHistory.split('\n').map(row => row.split('|')[0])
  assert.deepEqual(appliedMigrations, expectedMigrations())
  assert.ok(freshHistory.split('\n').every(row => row.split('|')[1]), 'Every applied migration has a checksum')
  assert.equal(sql('qa_fresh', 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;'), '0')
  assert.equal(sql('qa_fresh', 'SELECT count(*) FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL;'), '0')
  assert.match(prisma('migrate', 'deploy', '--schema', workspace.schemaPath), /No pending migrations/)
})
test('aggregates duplicates and computes exact server prices without trusting supplied totals', async () => {
  const p = await product(20)
  const response = await create({ ...bodyFor([{ productId: p.id, quantity: 2 }, { productId: p.id, quantity: 3 }]), total: 1, price: 0 })
  assert.equal(response.status, 201); assert.equal(response.data.items.length, 1)
  assert.equal(response.data.items[0].quantity, 5); assert.equal(response.data.total, 49.95); assert.equal(response.data.savings, 15)
  assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 15)
})
test('concurrent retries create one order and reserve stock once; changed payload/principal is rejected', async () => {
  const p = await product(2); const body = bodyFor([{ productId: p.id, quantity: 2 }]); const key = randomUUID()
  const results = await Promise.all([create(body, { key }), create(body, { key })])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 201])
  assert.ok(results[0].data.id === results[1].data.id)
  assert.ok(results[0].data.receiptToken === results[1].data.receiptToken)
  assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 0)
  const changed = await create(bodyFor([{ productId: p.id, quantity: 1 }]), { key })
  assert.equal(changed.status, 409); assert.equal(changed.data.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal((await create(body, { key, token: tokens.a })).status, 409)
})
test('simultaneous different orders never oversell; failed multi-product order fully rolls back', async () => {
  const p = await product(5)
  const responses = await Promise.all([create(bodyFor([{ productId: p.id, quantity: 3 }])), create(bodyFor([{ productId: p.id, quantity: 3 }]))])
  assert.deepEqual(responses.map(result => result.status).sort(), [201, 409])
  assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 2)
  const a = await product(4), b = await product(0)
  const orders = await db.order.count()
  const failed = await create(bodyFor([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }]))
  assert.equal(failed.status, 409); assert.equal(failed.data.productId, b.id)
  assert.equal(failed.data.code, 'ORDER_REJECTED')
  assert.equal((await db.product.findUnique({ where: { id: a.id } })).stock, 4)
  assert.equal(await db.order.count(), orders)
})
test('receipt enforces owner/admin/guest capability and returns only ok + receiptUrl', async () => {
  const p = await product(10)
  const own = await create(bodyFor([{ productId: p.id, quantity: 1 }]), { token: tokens.a })
  assert.ok(!Object.hasOwn(own.data, 'receiptToken'))
  const path = `/api/orders/${own.data.id}/receipt`
  const previousUploads = uploads
  assert.equal((await request(path, { method: 'POST', body: { file: png } })).status, 401)
  assert.equal((await request(path, { method: 'POST', body: { file: png }, token: tokens.b })).status, 403)
  assert.equal((await request(path, { method: 'POST', body: { file: png }, capability: 'a'.repeat(64) })).status, 401)
  assert.equal(uploads, previousUploads)
  for (const token of [tokens.a, tokens.admin]) {
    const result = await request(path, { method: 'POST', body: { file: png }, token })
    assert.equal(result.status, 200); assert.deepEqual(Object.keys(result.data).sort(), ['ok', 'receiptUrl'])
  }
  const guest = await create(bodyFor([{ productId: p.id, quantity: 1 }]))
  const other = await create(bodyFor([{ productId: p.id, quantity: 1 }]))
  const guestPath = `/api/orders/${guest.data.id}/receipt`
  assert.equal((await request(guestPath, { method: 'POST', body: { file: png }, capability: other.data.receiptToken })).status, 401)
  assert.equal((await request(guestPath, { method: 'POST', body: { file: png }, capability: guest.data.receiptToken })).status, 200)
  const saved = await db.order.findUnique({ where: { id: guest.data.id } })
  assert.ok(saved.receiptTokenHash !== guest.data.receiptToken)
  const mine = await request('/api/orders/me', { token: tokens.a })
  assert.ok(mine.data.every(order => !['receiptToken', 'receiptTokenHash', 'idempotencyKey', 'requestHash'].some(key => Object.hasOwn(order, key))))
  assert.equal((await request('/api/orders/qa-old-order/receipt', { method: 'POST', body: { file: png } })).status, 401)
})
test('small default JSON, upload-specific limits, signatures and authorization precede uploader', async () => {
  assert.equal((await request('/api/orders', { method: 'POST', body: { extra: 'a'.repeat(110 * 1024) } })).status, 413)
  assert.equal((await request('/api/admin/uploads', { method: 'POST', body: { image: png } })).status, 401)
  assert.equal((await request('/api/admin/uploads', { method: 'POST', body: { image: png }, token: tokens.b })).status, 403)
  const previous = uploads
  assert.equal((await request('/api/admin/uploads', { method: 'POST', body: { image: png.replace('image/png', 'image/jpeg') }, token: tokens.admin })).status, 400)
  assert.equal(uploads, previous)
  assert.equal((await request('/api/admin/uploads', { method: 'POST', body: { image: png }, token: tokens.admin })).status, 200)
  assert.equal((await request('/api/admin/uploads/model', { method: 'POST', body: { file: png, filename: 'qa.glb' }, token: tokens.admin })).status, 400)
  const gltf = 'data:application/json;base64,' + Buffer.from('{"asset":{"version":"2.0"}}').toString('base64')
  assert.equal((await request('/api/admin/uploads/model', { method: 'POST', body: { file: gltf, filename: 'qa.gltf' }, token: tokens.admin })).status, 200)
  const huge = 'data:image/png;base64,' + Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')
  assert.equal((await request('/api/admin/uploads', { method: 'POST', body: { image: huge }, token: tokens.admin })).status, 413)
  const p = await product(2); const own = await create(bodyFor([{ productId: p.id, quantity: 1 }]), { token: tokens.a })
  const path = `/api/orders/${own.data.id}/receipt`
  assert.equal((await request(path, { method: 'POST', body: { file: 'data:image/png;base64,aGVsbG8=' }, token: tokens.a })).status, 400)
  const largeReceipt = 'data:image/png;base64,' + Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64')
  assert.equal((await request(path, { method: 'POST', body: { file: largeReceipt }, token: tokens.a })).status, 413)
})
test('cancellation restores stock once under concurrency; terminal and backwards transitions fail', async () => {
  const p = await product(5); const created = await create(bodyFor([{ productId: p.id, quantity: 3 }]))
  const path = `/api/admin/orders/${created.data.id}/status`
  const cancel = () => request(path, { method: 'PATCH', body: { status: 'CANCELLED' }, token: tokens.admin })
  assert.deepEqual((await Promise.all([cancel(), cancel()])).map(result => result.status), [200, 200])
  assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 5)
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: created.data.id, status: 'CANCELLED' } }), 1)
  assert.equal((await request(path, { method: 'PATCH', body: { status: 'PAID' }, token: tokens.admin })).status, 409)
  assert.equal((await request('/api/admin/orders?status=BAD', { token: tokens.admin })).status, 400)
  assert.equal((await request('/api/admin/orders?status=PENDING&status=PAID', { token: tokens.admin })).status, 400)
  assert.equal((await request(path, { method: 'PATCH', body: { status: 'BAD' }, token: tokens.admin })).status, 400)
  assert.equal((await request('/api/admin/orders', { token: tokens.b })).status, 403)
})
test('legal delivery flow records each transition once; delivered order cannot cancel or return to paid', async () => {
  const p = await product(3); const created = await create(bodyFor([{ productId: p.id, quantity: 1 }]))
  const path = `/api/admin/orders/${created.data.id}/status`
  const update = status => request(path, { method: 'PATCH', body: { status }, token: tokens.admin })
  assert.equal((await update('PENDING')).status, 200)
  for (const status of ['CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED']) {
    assert.equal((await update(status)).status, 200)
    assert.equal((await update(status)).status, 200)
    assert.equal(await db.orderStatusHistory.count({ where: { orderId: created.data.id, status } }), 1)
  }
  assert.equal((await update('CANCELLED')).status, 409)
  assert.equal((await update('PAID')).status, 409)
  assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 2)
})
test('CORS preflight allows the checkout and receipt headers', async () => {
  const response = await fetch(base + '/api/orders', { method: 'OPTIONS', headers: {
    Origin: 'http://qa.invalid', 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'idempotency-key,x-receipt-token,authorization,content-type',
  } })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://qa.invalid')
  assert.ok(response.headers.get('access-control-allow-headers').includes('idempotency-key'))
})
test('missing/invalid auth and idempotency keys never create an order; rate limits return 429', async () => {
  const p = await product(1); const body = bodyFor([{ productId: p.id, quantity: 1 }]); const count = await db.order.count()
  assert.equal((await create(body, { key: undefined })).status, 400)
  assert.equal((await create(body, { token: 'invalid-qa-token' })).status, 401)
  assert.equal(await db.order.count(), count)
  createLimit.resetKey('127.0.0.1')
  for (let i = 0; i < 20; i++) assert.equal((await request('/api/orders', { method: 'POST', body: {} })).status, 400)
  assert.equal((await request('/api/orders', { method: 'POST', body: {} })).status, 429)
  for (let i = 0; i < 30; i++) assert.equal((await request('/api/orders/qa-old-order/receipt', { method: 'POST', body: {} })).status, 401)
  assert.equal((await request('/api/orders/qa-old-order/receipt', { method: 'POST', body: {} })).status, 429)
})
