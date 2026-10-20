import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
import { processOrderEmails } from '../../src/lib/orderEmails.js'
import { orderEmailTemplate } from '../../src/lib/mailer.js'
import { runPrisma } from './helpers/isolated-runtime.mjs'
import { join } from 'node:path'

let rt, orders, product
const baseBody = () => ({
  customer: { nombre: 'QA', apellido: 'Correo', correo: 'qa@example.test', celular: '900000000' },
  delivery: { tipoEntrega: 'recojo', departamento: 'QA', provincia: 'QA', distrito: 'QA' },
  paymentMethod: 'qa-payment', items: [{ productId: product.id, quantity: 1 }],
})
before(async () => {
  delete process.env.ORDER_EMAILS_ENABLED
  rt = await createInventoryRuntime()
  orders = await rt.load('server/src/lib/orderService.js')
  product = await rt.product(10)
  await rt.db.paymentMethod.create({ data: {
    key: 'qa-payment', label: 'Yape QA', config: { instructions: 'Consultar al equipo', accountNumber: '1912345678901', phoneNumber: '900000000' },
  } })
}, { timeout: 180000 })
after(async () => { await rt?.close() })

test('apagado no consulta DB ni proveedor', async () => {
  const forbidden = new Proxy({}, { get() { throw Error('No DB expected') } })
  assert.deepEqual(await processOrderEmails({ db: forbidden, send: () => { throw Error('No email expected') } }), { enabled: false, sent: 0, failed: 0, review: 0 })
})

test('cinco estados, duplicados y workers simultáneos envían una sola vez sin cambiar stock', async () => {
  const created = await orders.createOrder(rt.db, baseBody(), rt.customer, randomUUID(), 'qa-only')
  const other = await orders.createOrder(rt.db, baseBody(), rt.customer, randomUUID(), 'qa-only')
  for (const status of ['CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED']) {
    await orders.changeOrderStatus(rt.db, created.order.id, status, 'Estado sintético QA', rt.admin.id)
  }
  await orders.changeOrderStatus(rt.db, other.order.id, 'CANCELLED', 'Cancelación sintética QA', rt.admin.id)
  await rt.db.orderStatusHistory.create({ data: { orderId: created.order.id, status: 'PAID', note: 'Duplicado sintético para comprobar outbox único' } })
  const snapshot = await rt.db.product.findUnique({ where: { id: product.id } })
  const calls = new Map()
  const send = async input => {
    assert.equal(input.order.customerCorreo, 'qa@example.test')
    calls.set(input.idempotencyKey, (calls.get(input.idempotencyKey) || 0) + 1)
    return { id: 'qa-provider-' + input.idempotencyKey }
  }
  const jobs = await Promise.all([processOrderEmails({ db: rt.db, send, enabled: true }), processOrderEmails({ db: rt.db, send, enabled: true })])
  assert.equal(jobs.reduce((n, row) => n + row.sent, 0), 6)
  assert.equal(calls.size, 6)
  assert.ok([...calls.values()].every(value => value === 1))
  assert.equal((await processOrderEmails({ db: rt.db, send, enabled: true })).sent, 0)
  assert.equal((await rt.db.product.findUnique({ where: { id: product.id } })).stock, snapshot.stock)
  assert.equal((await rt.db.order.findUnique({ where: { id: created.order.id } })).status, 'DELIVERED')
})

test('fallo y respuesta incierta no revierten pedido; reintento conserva la clave del proveedor', async () => {
  const created = await orders.createOrder(rt.db, baseBody(), rt.customer, randomUUID(), 'qa-only')
  const count = await rt.db.inventoryMovement.count()
  const accepted = new Map()
  let first = true
  const send = async ({ idempotencyKey }) => {
    accepted.set(idempotencyKey, 'qa-real-provider-response')
    if (first) { first = false; throw Error('Synthetic lost connection after acceptance') }
    return { id: accepted.get(idempotencyKey) }
  }
  assert.equal((await processOrderEmails({ db: rt.db, send, enabled: true })).failed, 1)
  const row = await rt.db.orderEmailDelivery.findFirst({ where: { orderId: created.order.id } })
  assert.equal(row.state, 'PENDING')
  assert.equal(row.lastErrorCode, 'PROVIDER_UNCONFIRMED')
  assert.equal((await rt.db.order.findUnique({ where: { id: created.order.id } })).status, 'PENDING')
  assert.equal(await rt.db.inventoryMovement.count(), count)
  assert.equal((await processOrderEmails({ db: rt.db, send, enabled: true })).sent, 1)
  assert.equal(accepted.size, 1)
  assert.equal((await rt.db.orderEmailDelivery.findUnique({ where: { id: row.id } })).attempts, 2)
})

test('sin id no se marca enviado y fuera de 23 horas queda para conciliación', async () => {
  const created = await orders.createOrder(rt.db, baseBody(), rt.customer, randomUUID(), 'qa-only')
  assert.equal((await processOrderEmails({ db: rt.db, enabled: true, send: async () => ({}) })).failed, 1)
  const row = await rt.db.orderEmailDelivery.findFirst({ where: { orderId: created.order.id } })
  const now = () => new Date(row.firstAttemptAt.getTime() + 23 * 3600000)
  const result = await processOrderEmails({ db: rt.db, enabled: true, now, send: async () => { throw Error('must not contact provider') } })
  assert.equal(result.review, 1)
  const expired = await rt.db.orderEmailDelivery.findUnique({ where: { id: row.id } })
  assert.equal(expired.state, 'REVIEW')
  assert.equal(expired.sentAt, null)
})

test('plantillas escapan HTML y no exponen tokens, QR, teléfonos, cuenta, CCI ni dirección', () => {
  const order = { id: 'qa-order', customerCorreo: 'qa@example.test', direccion: 'QA private address', receiptTokenHash: 'qa-private-token',
    total: '0.30', items: [{ name: '<script>alert(1)</script>', quantity: 1, unitPrice: '0.30' }],
    paymentMethod: { label: 'Transferencia QA', config: { instructions: 'Cuenta 1912345678901 https://example.test/?token=qa-secret', accountNumber: '1912345678901', phoneNumber: '900000000', cci: '00212345678900123456', qrImageUrl: 'https://example.test/qr' } } }
  for (const status of ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']) {
    const template = orderEmailTemplate({ order, status })
    assert.ok(template.subject.includes('TecRuta'))
    assert.ok(template.html.includes('&lt;script&gt;'))
    assert.ok(template.html.includes('0.30'))
    for (const value of ['<script>', '1912345678901', '900000000', '00212345678900123456', 'qa-secret', 'qa-private-token', 'QA private address', 'example.test/qr']) assert.equal(template.html.includes(value), false)
    assert.equal(template.html.includes('Garantía'), false)
  }
  const terms = orderEmailTemplate({ order, status: 'PENDING', business: { warrantyText: 'Condición sintética QA', shippingText: 'Envío sintético QA' } })
  assert.ok(terms.html.includes('Condición sintética QA'))
})

test('Prisma y migraciones reproducen el esquema en PostgreSQL local', () => {
  const schemaPath = join(rt.tempRoot, 'schema/schema.prisma')
  assert.match(runPrisma({ root: rt.root, tempRoot: rt.tempRoot, schemaPath, dotenvPath: process.env.DOTENV_CONFIG_PATH,
    databaseUrl: process.env.DATABASE_URL, args: ['migrate', 'diff', '--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath, '--script', '--exit-code'] }), /empty migration/)
})
