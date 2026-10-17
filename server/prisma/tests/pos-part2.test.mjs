import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
import { runPrisma } from './helpers/isolated-runtime.mjs'
import { cents, amount, returnCents } from '../../../src/utils/posMoney.js'
let rt, base, svc, schemas, orders, adminSession
const key = () => randomUUID()
const stock = async id => (await rt.db.product.findUnique({ where: { id } })).stock
const input = (p, session, extra = {}) => schemas.saleSchema.parse({ requestId: key(), sessionId: session.id, mode: 'CONFIRM', items: [{ productId: p.id, quantity: 1, expectedPrice: String(p.price) }], payments: [{ method: 'cashOnDelivery', amount: String(p.price), received: '100.00', verified: true }], ...extra })
const call = async (path, { user = rt.cashier, method = 'GET', body } = {}) => {
  const response = await fetch(base + '/api/pos' + path, { method, headers: { Authorization: 'Bearer ' + rt.auth(user), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() }
}
const actor = async (role = 'CASHIER', opening = '100.00') => {
  const user = await rt.db.user.create({ data: { email: `qa-${key()}@example.test`, passwordHash: 'synthetic', nombre: 'QA', apellido: role, role, verified: true } })
  return { user, session: await svc.openCash(rt.db, user, { requestId: key(), openingAmount: opening }) }
}
const product = (stock = 5, price = '10.00') => rt.product(stock, { price })
const refundBody = (sale, extra = {}) => {
  const result = { requestId: key(), sessionId: adminSession.id, kind: 'RETURN', reason: 'Devolucion sintetica QA', method: 'cashOnDelivery', verified: true,
    items: [{ saleItemId: sale.items[0].id, quantity: 1, restock: true }], ...extra }
  result.expectedAmount = amount(result.items.reduce((sum, item) => {
    const line = sale.items.find(row => row.id === item.saleItemId)
    const returned = line.returns.reduce((n, row) => n + row.quantity, 0)
    return returned + item.quantity > line.quantity ? sum : sum + returnCents(String(line.lineTotal), line.quantity, returned, item.quantity)
  }, 0n))
  return result
}
before(async () => {
  rt = await createInventoryRuntime(); base = await rt.start()
  svc = await rt.load('server/src/lib/posService.js'); schemas = await rt.load('server/src/lib/posSchemas.js'); orders = await rt.load('server/src/lib/orderService.js')
  await rt.db.paymentMethod.createMany({ data: ['cashOnDelivery','yape','plin','bankTransfer'].map(key => ({ key, label: 'QA ' + key, active: true, config: {} })) })
  adminSession = await svc.openCash(rt.db, rt.admin, { requestId: key(), openingAmount: '1000.00' })
}, { timeout: 180000 })
after(async () => { if (rt) await rt.close() })

test('Importes decimales exactos y filtros de dias America/Lima', async () => {
  assert.equal(cents('0.10') + cents('0.20'), 30n); assert.equal(amount(30n), '0.30'); assert.throws(() => cents('1.001')); assert.throws(() => cents(0.1))
  const { limaRange } = await rt.load('server/src/lib/posReports.js')
  assert.equal(limaRange({ from: '2026-10-17', to: '2026-10-17' }).gte.toISOString(), '2026-10-17T05:00:00.000Z')
  assert.equal(limaRange({ from: '2026-10-17', to: '2026-10-17' }).lte.toISOString(), '2026-10-18T04:59:59.999Z')
})

test('Permisos API y caja individual; descuentos y devoluciones reservados a admin', async () => {
  for (const user of [rt.customer, rt.warehouse]) assert.equal((await call('/config', { user })).status, 403)
  assert.equal((await call('/config')).status, 200)
  const a = await actor(), p = await product()
  assert.equal((await call('/sales', { user: a.user, method: 'POST', body: input(p, a.session, { discount: '1.00', discountReason: 'QA', payments: [{ method: 'cashOnDelivery', amount: '9.00', verified: true }] }) })).status, 403)
  assert.equal((await call('/cash/' + a.session.id + '/entries', { user: a.user, method: 'POST', body: { requestId: key(), direction: 'IN', amount: '1', reason: 'QA' } })).status, 403)
  assert.equal((await call('/sales', { method: 'POST', body: input(p, a.session) })).status, 403)
  const s = await svc.createSale(rt.db, a.user, input(p, a.session))
  assert.equal((await call('/sales/' + s.id + '/refunds', { user: a.user, method: 'POST', body: refundBody(s) })).status, 403)
  assert.equal(await rt.db.user.count({ where: { email: { contains: 'consumidor-final' } } }), 0)
})

test('Escaneo identifica ceros y busqueda devuelve DTO pequeño sobre indices', async () => {
  const p = await product()
  await rt.db.productBarcode.create({ data: { productId: p.id, code: '00001234', normalizedCode: '00001234', kind: 'MANUFACTURER' } })
  const lookup = await fetch(base + '/api/admin/inventory/lookup?code=00001234', { headers: { Authorization: 'Bearer ' + rt.auth(rt.cashier) } })
  assert.equal((await lookup.json()).id, p.id)
  const search = await call('/products?q=00001234')
  assert.equal(search.status, 200); assert.equal(search.data[0].id, p.id); assert.equal(search.data[0].description, undefined)
  const indices = await rt.db.$queryRaw`SELECT indexname FROM pg_indexes WHERE indexname IN ('products_pos_name_search_idx','products_pos_sku_search_idx','barcodes_pos_search_idx')`
  assert.equal(indices.length, 3)
})

test('Venta simultanea repetida cobra, descuenta y registra Kardex exactamente una vez; vuelto', async () => {
  const a = await actor(), p = await product()
  const body = input(p, a.session, { customerName: 'Cliente QA', customerDocument: 'QA-123', payments: [{ method: 'cashOnDelivery', amount: '10.00', received: '20.00', verified: true }] })
  const results = await Promise.all([1,2].map(() => svc.createSale(rt.db, a.user, body)))
  assert.equal(results[0].id, results[1].id); assert.equal(await stock(p.id), 4)
  assert.equal(results[0].payments[0].change, '10')
  assert.equal(await svc.cashBalance(rt.db, a.session), 11000n)
  assert.equal(await rt.db.inventoryMovement.count({ where: { productId: p.id, type: 'POS_SALE' } }), 1)
  await assert.rejects(svc.createSale(rt.db, a.user, { ...body, customerName: 'otro' }), { status: 409 })
})

test('Pagos combinados: solo efectivo cambia caja, referencia y verificacion manual obligatorias', async () => {
  const a = await actor(), p = await product()
  const payments = [{ method: 'cashOnDelivery', amount: '4.00', received: '5.00', verified: true }, { method: 'yape', amount: '6.00', reference: 'QA-YAPE-01', verified: true }]
  const sale = await svc.createSale(rt.db, a.user, input(p, a.session, { payments }))
  assert.equal(sale.status, 'CONFIRMED'); assert.equal(sale.payments.length, 2); assert.equal(await svc.cashBalance(rt.db, a.session), 10400n)
  await assert.rejects(svc.createSale(rt.db, a.user, input(p, a.session, { payments: [{ method: 'plin', amount: '10', verified: false, reference: 'captura' }] })), { status: 409 })
  await assert.rejects(svc.createSale(rt.db, a.user, input(p, a.session, { payments: [{ method: 'plin', amount: '10', verified: true }] })), { status: 400 })
  assert.equal(await stock(p.id), 4)
})

test('Pendiente no cobra ni reserva; confirmar revalida precio/stock y pago', async () => {
  const a = await actor(), p = await product()
  const sale = await svc.createSale(rt.db, a.user, input(p, a.session, { mode: 'PENDING' }))
  assert.equal(await stock(p.id), 5); assert.equal(sale.payments[0].status, 'PENDING'); assert.equal(await svc.cashBalance(rt.db, a.session), 10000n)
  const confirm = schemas.confirmSaleSchema.parse({ requestId: key(), sessionId: a.session.id, payments: [{ method: 'cashOnDelivery', amount: '10', verified: true }] })
  const { updateAdminProduct } = await rt.load('server/src/lib/adminProducts.js')
  await updateAdminProduct(rt.db, p.id, { price: '11.00' }, rt.admin.id)
  await assert.rejects(svc.confirmSale(rt.db, a.user, sale.id, confirm), { status: 409 })
  assert.equal(await stock(p.id), 5)
  await updateAdminProduct(rt.db, p.id, { price: '10.00' }, rt.admin.id)
  const rows = await Promise.all([1,2].map(() => svc.confirmSale(rt.db, a.user, sale.id, confirm)))
  assert.equal(rows[0].id, rows[1].id); assert.equal(await stock(p.id), 4)
})

test('Respuesta perdida tras COMMIT: error de conexion y reintento recuperan una sola venta', async () => {
  const a = await actor(), p = await product(), body = input(p, a.session)
  const proxy = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    await fetch(base + '/api/pos/sales', { method: 'POST', headers: { Authorization: 'Bearer ' + rt.auth(a.user), 'Content-Type': 'application/json' }, body: Buffer.concat(chunks) })
    res.socket.destroy()
  })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
  try {
    await assert.rejects(fetch('http://127.0.0.1:' + proxy.address().port, { method: 'POST', body: JSON.stringify(body) }))
    const recovered = await call('/sales', { user: a.user, method: 'POST', body })
    assert.equal(recovered.status, 200); assert.equal(await stock(p.id), 4); assert.equal(await svc.cashBalance(rt.db, a.session), 11000n)
    assert.equal(await rt.db.posSale.count({ where: { items: { some: { productId: p.id } } } }), 1)
  } finally { await new Promise(resolve => proxy.close(resolve)) }
})

const checkout = p => ({ customer: { nombre: 'QA', apellido: 'Web', correo: 'qa@example.test', celular: '999999999' }, delivery: { tipoEntrega: 'recojo', departamento: 'Lima', provincia: 'Lima', distrito: 'Lima' }, items: [{ productId: p.id, quantity: 1 }] })
test('Venta web y POS concurrentes comparten la ultima unidad y rollback financiero', async () => {
  const a = await actor(), p = await product(1)
  const results = await Promise.allSettled([svc.createSale(rt.db, a.user, input(p, a.session)), orders.createOrder(rt.db, checkout(p), null, key(), 'qa-secret-only')])
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1); assert.equal(await stock(p.id), 0)
  const soldByPos = results[0].status === 'fulfilled'
  assert.equal(await svc.cashBalance(rt.db, a.session), soldByPos ? 11000n : 10000n)
})

test('Cobrar pedido web no descuenta otra vez; no duplicar cobro, cancelacion ni reposicion', async () => {
  const a = await actor(), p = await product(3)
  const { order } = await orders.createOrder(rt.db, checkout(p), null, key(), 'qa-secret-only')
  assert.equal(await stock(p.id), 2)
  const body = schemas.saleSchema.parse({ requestId: key(), sessionId: a.session.id, orderId: order.id, mode: 'CONFIRM', payments: [{ method: 'plin', amount: '10.00', reference: 'QA-WEB-PAY', verified: true }] })
  const s = await svc.createSale(rt.db, a.user, body)
  assert.equal(await stock(p.id), 2); assert.equal((await rt.db.order.findUnique({ where: { id: order.id } })).status, 'PAID')
  await assert.rejects(svc.createSale(rt.db, a.user, { ...body, requestId: key() }), { status: 409 })
  await assert.rejects(orders.changeOrderStatus(rt.db, order.id, 'CANCELLED', 'QA', rt.admin.id), { status: 409 })
  await svc.refundSale(rt.db, rt.admin, s.id, refundBody(s, { kind: 'VOID' }))
  assert.equal(await stock(p.id), 3)
  await orders.changeOrderStatus(rt.db, order.id, 'CANCELLED', 'QA', rt.admin.id)
  assert.equal(await stock(p.id), 3)
})

test('Devoluciones parciales, dañadas y descuento prorrateado: no devolver de mas', async () => {
  const p = await product(5, '3.33')
  const s = await svc.createSale(rt.db, rt.admin, input(p, adminSession, { items: [{ productId: p.id, quantity: 3, expectedPrice: '3.33' }], discount: '0.02', discountReason: 'Aprobado por QA admin', payments: [{ method: 'cashOnDelivery', amount: '9.97', verified: true }] }))
  assert.equal(s.approvedById, rt.admin.id); assert.equal(await stock(p.id), 2)
  const first = refundBody(s, { items: [{ saleItemId: s.items[0].id, quantity: 1, restock: false }] })
  const returned = await svc.refundSale(rt.db, rt.admin, s.id, first)
  assert.equal(await stock(p.id), 2); assert.equal(returned.refunds[0].amount, '3.32')
  await assert.rejects(svc.refundSale(rt.db, rt.admin, s.id, refundBody(s, { items: [{ saleItemId: s.items[0].id, quantity: 3, restock: true }] })), { status: 409 })
  const second = refundBody(returned, { items: [{ saleItemId: s.items[0].id, quantity: 2, restock: true }] })
  const [done, replay] = await Promise.all([1,2].map(() => svc.refundSale(rt.db, rt.admin, s.id, second)))
  assert.equal(done.status, 'RETURNED'); assert.equal(done.id, replay.id); assert.equal(await stock(p.id), 4)
  const total = done.refunds.reduce((sum, row) => sum + cents(row.amount), 0n)
  assert.equal(total, 997n)
  await assert.rejects(rt.db.posSale.delete({ where: { id: s.id } }))
  await assert.rejects(rt.db.posPayment.update({ where: { id: s.payments[0].id }, data: { amount: '1' } }))
})

test('Caja: apertura unica, movimientos autorizados, cierre exacto y cerrado inmutable', async () => {
  const a = await actor('ADMIN', '100.00')
  await assert.rejects(svc.openCash(rt.db, a.user, { requestId: key(), openingAmount: '0' }), { status: 409 })
  const receipt = { requestId: key(), direction: 'IN', amount: '5.00', reason: 'Ingreso QA' }
  await Promise.all([1,2].map(() => svc.manualCash(rt.db, a.user, a.session.id, receipt)))
  await svc.manualCash(rt.db, a.user, a.session.id, { requestId: key(), direction: 'OUT', amount: '3.00', reason: 'Retiro QA' })
  const close = { requestId: key(), countedAmount: '101.00', reason: 'Conteo sintetico' }
  const closed = await svc.closeCash(rt.db, a.user, a.session.id, close)
  assert.equal(closed.expectedAmount, '102'); assert.equal(closed.difference, '-1')
  assert.equal((await svc.closeCash(rt.db, a.user, a.session.id, close)).id, a.session.id)
  await assert.rejects(svc.manualCash(rt.db, a.user, a.session.id, { ...receipt, requestId: key() }), { status: 409 })
  await assert.rejects(rt.db.cashSession.update({ where: { id: a.session.id }, data: { status: 'OPEN' } }))
  await assert.rejects(rt.db.cashEntry.deleteMany({ where: { sessionId: a.session.id } }))
})

test('Confirmacion y cierre concurrentes: cierre incluye venta o venta revierte sin afectar stock', async () => {
  const a = await actor(), p = await product()
  const results = await Promise.allSettled([svc.createSale(rt.db, a.user, input(p, a.session)), svc.closeCash(rt.db, a.user, a.session.id, { requestId: key(), countedAmount: '100.00', reason: 'QA race' })])
  const saleSucceeded = results[0].status === 'fulfilled'
  assert.equal(await stock(p.id), saleSucceeded ? 4 : 5)
  const session = await rt.db.cashSession.findUnique({ where: { id: a.session.id } })
  assert.equal(String(session.expectedAmount), saleSucceeded ? '110' : '100')
})

test('Configuracion de metodos y pagos combinados se verifica en servidor', async () => {
  const a = await actor(), p = await product()
  await rt.db.siteSetting.upsert({ where: { key: 'posConfig' }, create: { key: 'posConfig', value: { allowMixed: false } }, update: { value: { allowMixed: false } } })
  await assert.rejects(svc.createSale(rt.db, a.user, input(p, a.session, { payments: [{ method: 'cashOnDelivery', amount: '5', verified: true }, { method: 'yape', amount: '5', reference: 'QA', verified: true }] })), { status: 409 })
  await rt.db.siteSetting.update({ where: { key: 'posConfig' }, data: { value: { allowMixed: true } } })
  await rt.db.paymentMethod.update({ where: { key: 'bankTransfer' }, data: { active: false } })
  await assert.rejects(svc.createSale(rt.db, a.user, input(p, a.session, { payments: [{ method: 'bankTransfer', amount: '10', reference: 'QA', verified: true }] })), { status: 409 })
  assert.equal(await stock(p.id), 5)
  await rt.db.paymentMethod.update({ where: { key: 'bankTransfer' }, data: { active: true } })
})

test('Reportes, CSV, historiales y adaptador fiscal desactivado sin emision simulada', async () => {
  const reports = await call('/reports?type=sales', { user: rt.admin })
  assert.equal(reports.status, 200); assert.equal(reports.data.timeZone, 'America/Lima'); assert.ok(reports.data.rows.length > 0)
  assert.equal(reports.data.rows[0].profit, null)
  for (const type of ['payments','products','refunds','cash','low-stock']) assert.equal((await call('/reports?type=' + type, { user: rt.admin })).status, 200)
  const csv = await call('/reports/export.csv?type=sales', { user: rt.admin }); assert.equal(csv.status, 200); assert.ok(csv.data.includes('subtotal'))
  const fiscal = await call('/fiscal', { user: rt.admin }); assert.equal(fiscal.data.enabled, false)
  assert.equal((await call('/sales/qa/fiscal', { user: rt.admin, method: 'POST', body: {} })).status, 503)
  const { createFiscalGateway } = await rt.load('server/src/lib/fiscalGateway.js')
  await assert.rejects(createFiscalGateway({ name: 'QA-only', issue: async () => ({ status: 'ACCEPTED' }), lookup: async () => ({}) }).issue({}), { status: 502 })
})

test('Migracion coincide con Prisma y no altera saldos previos', () => {
  const schemaPath = join(rt.tempRoot, 'schema/schema.prisma')
  const result = runPrisma({ root: rt.root, tempRoot: rt.tempRoot, schemaPath, dotenvPath: join(rt.tempRoot, 'qa-empty-dotenv'), databaseUrl: process.env.DATABASE_URL,
    args: ['migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', schemaPath, '--exit-code'] })
  assert.match(result, /No difference detected/)
})

test('Pendiente cancelado conserva motivo y stock; faltante al cobrar revierte pagos', async () => {
  const a = await actor(), p = await product(1)
  const pending = await svc.createSale(rt.db, a.user, input(p, a.session, { mode: 'PENDING', payments: [] }))
  const cancelled = await svc.cancelPendingSale(rt.db, a.user, pending.id, { requestId: key(), reason: 'Cliente desistio QA' })
  assert.equal(cancelled.cancellationReason, 'Cliente desistio QA'); assert.equal(await stock(p.id), 1)
  const second = await svc.createSale(rt.db, a.user, input(p, a.session, { mode: 'PENDING', payments: [] }))
  await orders.createOrder(rt.db, checkout(p), null, key(), 'qa-only-secret')
  await assert.rejects(svc.confirmSale(rt.db, a.user, second.id, { requestId: key(), sessionId: a.session.id, payments: [{ method: 'cashOnDelivery', amount: '10', verified: true }] }), { status: 409 })
  assert.equal(await svc.cashBalance(rt.db, a.session), 10000n)
  assert.equal((await rt.db.posSale.findUnique({ where: { id: second.id } })).status, 'PENDING')
})

test('Dos devoluciones simultaneas con claves distintas no reembolsan la misma unidad', async () => {
  const a = await actor(), p = await product(1), sale = await svc.createSale(rt.db, a.user, input(p, a.session))
  const before = await svc.cashBalance(rt.db, adminSession)
  const results = await Promise.allSettled([1,2].map(() => svc.refundSale(rt.db, rt.admin, sale.id, refundBody(sale))))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(await stock(p.id), 1); assert.equal(await svc.cashBalance(rt.db, adminSession), before - 1000n)
  assert.equal(await rt.db.posRefund.count({ where: { saleId: sale.id } }), 1)
})

test('Devolucion sin efectivo o importe obsoleto no aplica movimientos parciales', async () => {
  const a = await actor(), p = await product(1), sale = await svc.createSale(rt.db, a.user, input(p, a.session))
  const empty = await actor('ADMIN', '0.00')
  await assert.rejects(svc.refundSale(rt.db, empty.user, sale.id, refundBody(sale, { sessionId: empty.session.id })), { status: 409 })
  const body = refundBody(sale); body.expectedAmount = '9.99'
  await assert.rejects(svc.refundSale(rt.db, rt.admin, sale.id, body), { status: 409 })
  assert.equal(await stock(p.id), 0); assert.equal(await rt.db.posRefund.count({ where: { saleId: sale.id } }), 0)
})

test('Admin no marca pagado desde una captura y devolucion parcial bloquea despacho integro', async () => {
  const a = await actor(), p = await product(3)
  const checkoutBody = checkout(p); checkoutBody.items[0].quantity = 2
  const { order } = await orders.createOrder(rt.db, checkoutBody, null, key(), 'qa-only-secret')
  const response = await fetch(base + '/api/admin/orders/' + order.id + '/status', { method: 'PATCH', headers: { Authorization: 'Bearer ' + rt.auth(rt.admin), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PAID' }) })
  assert.equal(response.status, 409)
  const sale = await svc.createSale(rt.db, a.user, schemas.saleSchema.parse({ requestId: key(), sessionId: a.session.id, orderId: order.id, mode: 'CONFIRM', payments: [{ method: 'cashOnDelivery', amount: '20', verified: true }] }))
  await svc.refundSale(rt.db, rt.admin, sale.id, refundBody(sale))
  await assert.rejects(orders.changeOrderStatus(rt.db, order.id, 'SHIPPED', 'QA'), { status: 409 })
  assert.equal(await stock(p.id), 2)
})
