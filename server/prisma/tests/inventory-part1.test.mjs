import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
import { runDocker, runPrisma } from './helpers/isolated-runtime.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
let rt, base, service, orders
const stock = async id => (await rt.db.product.findUnique({ where: { id } })).stock
const api = async (path, { user, method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + rt.auth(user) } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() }
}
const inv = (path, options) => api('/api/admin/inventory' + path, options)
const draft = (p, extra = {}) => ({ requestId: randomUUID(), productId: p.id, type: 'PURCHASE', direction: 'IN', quantity: 2, reason: 'Synthetic QA', createdById: rt.admin.id, ...extra })
before(async () => {
  rt = await createInventoryRuntime(); base = await rt.start()
  service = await rt.load('server/src/lib/inventoryService.js'); orders = await rt.load('server/src/lib/orderService.js')
}, { timeout: 180000 })
after(async () => { if (rt) await rt.close() })

test('API: cuentas y permisos reales, sin confiar en el rol del JWT', async () => {
  assert.equal((await inv('/summary')).status, 401)
  assert.equal((await inv('/summary', { user: rt.customer })).status, 403)
  const p = await rt.product()
  assert.equal((await inv('/labels?ids=' + p.id, { user: rt.cashier })).status, 403)
  assert.equal((await inv('/labels?ids=' + p.id, { user: rt.warehouse })).status, 200)
  for (const user of [rt.admin, rt.warehouse, rt.cashier]) assert.equal((await inv('/summary', { user })).status, 200)
  const { direction, createdById, ...body } = draft(p)
  for (const user of [rt.customer, rt.cashier]) assert.equal((await inv('/movements', { user, method: 'POST', body })).status, 403)
  assert.equal((await inv('/movements', { user: rt.warehouse, method: 'POST', body })).status, 201)
  assert.equal((await api('/api/admin/products', { user: rt.warehouse, method: 'POST', body: {} })).status, 403)
  assert.equal((await api('/api/admin/users/' + rt.cashier.id + '/role', { user: rt.cashier, method: 'PATCH', body: { role: 'ADMIN' } })).status, 403)
  await rt.db.user.update({ where: { id: rt.cashier.id }, data: { role: 'CUSTOMER' } })
  assert.equal((await inv('/summary', { user: rt.cashier })).status, 403)
  await rt.db.user.update({ where: { id: rt.cashier.id }, data: { role: 'CASHIER' } })
})

test('SKU, fabricante e internos: ceros iniciales y unicidad cruzada concurrente', async () => {
  const a = await rt.product(), b = await rt.product()
  const add = (product, code) => inv('/products/' + product.id + '/barcodes', { method: 'POST', user: rt.warehouse, body: { code, kind: 'MANUFACTURER' } })
  assert.equal((await add(a, '001234567890')).status, 201)
  const found = await inv('/lookup?code=001234567890', { user: rt.cashier })
  assert.equal(found.data.id, a.id); assert.equal(found.data.barcodes[0].code, '001234567890')
  assert.equal((await inv('/lookup?code=1234567890', { user: rt.cashier })).status, 404)
  assert.equal((await add(b, '001234567890')).status, 409)
  assert.equal((await add(b, a.sku)).status, 409)
  const simultaneous = await Promise.all([add(a, 'QA-SHARED-CODE'), add(b, 'qa-shared-code')])
  assert.deepEqual(simultaneous.map(x => x.status).sort(), [201, 409])
  const { updateAdminProduct } = await rt.load('server/src/lib/adminProducts.js')
  await assert.rejects(updateAdminProduct(rt.db, b.id, { sku: '001234567890' }, rt.admin.id), { status: 409 })
  await assert.rejects(updateAdminProduct(rt.db, b.id, { sku: null }, rt.admin.id), { status: 400 })
  assert.equal((await add(a, 123)).status, 400)
})

test('Borrador idempotente, confirmaciones concurrentes y costo conocido', async () => {
  const p = await rt.product(3), input = draft(p, { unitCost: 2.35, supplier: 'QA Supplier' })
  const ds = await Promise.all([service.createDraftMovement(rt.db, input), service.createDraftMovement(rt.db, input)])
  assert.equal(ds[0].id, ds[1].id); assert.equal(await stock(p.id), 3)
  await assert.rejects(service.createDraftMovement(rt.db, { ...input, quantity: 4 }), { status: 409 })
  const confirmed = await Promise.all(ds.map(d => service.confirmDraftMovement(rt.db, d.id, rt.warehouse.id)))
  assert.equal(confirmed[0].id, confirmed[1].id); assert.equal(await stock(p.id), 5)
  assert.equal(confirmed[0].unitCost, 2.35)
  const persisted = await rt.db.inventoryMovement.findUnique({ where: { id: ds[0].id } })
  assert.equal(persisted.confirmedById, rt.warehouse.id)
})

test('Todos los motivos de entrada/salida se confirman; stock y asiento son atomicos', async () => {
  const p = await rt.product(10)
  for (const type of ['PURCHASE','CUSTOMER_RETURN','POSITIVE_ADJUSTMENT','LOSS','DAMAGE','SUPPLIER_RETURN','NEGATIVE_ADJUSTMENT']) {
    const d = await service.createDraftMovement(rt.db, draft(p, { type, direction: service.movementDirection(type), quantity: 1 }))
    await service.confirmDraftMovement(rt.db, d.id, rt.admin.id)
  }
  assert.equal(await stock(p.id), 9)
  const d = await service.createDraftMovement(rt.db, draft(p, { type: 'LOSS', direction: 'OUT', quantity: 100 }))
  await assert.rejects(service.confirmDraftMovement(rt.db, d.id, rt.admin.id), { status: 409 })
  assert.equal((await rt.db.inventoryMovement.findUnique({ where: { id: d.id } })).status, 'DRAFT')
  assert.equal(await stock(p.id), 9)
})

test('Dos salidas simultaneas no consumen la misma ultima unidad', async () => {
  const p = await rt.product(1)
  const ds = await Promise.all([1,2].map(() => service.createDraftMovement(rt.db, draft(p, { type: 'LOSS', direction: 'OUT', quantity: 1 }))))
  const results = await Promise.allSettled(ds.map(d => service.confirmDraftMovement(rt.db, d.id, rt.admin.id)))
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(await stock(p.id), 0)
})

test('Reversion enlazada, unica, inmutable y sin negativos', async () => {
  const p = await rt.product(5), d = await service.createDraftMovement(rt.db, draft(p))
  await service.confirmDraftMovement(rt.db, d.id, rt.admin.id)
  const results = await Promise.allSettled([1,2].map(() => service.reverseMovement(rt.db, d.id, rt.admin.id, 'Correccion QA')))
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(await stock(p.id), 5)
  const rev = results.find(x => x.status === 'fulfilled').value
  assert.equal(rev.reversalOfId, d.id)
  await assert.rejects(rt.db.inventoryMovement.update({ where: { id: d.id }, data: { reason: 'Mutated' } }))
  await assert.rejects(rt.db.inventoryMovement.delete({ where: { id: d.id } }))
  const opening = await rt.db.inventoryMovement.findFirst({ where: { productId: p.id, type: 'INITIAL_BALANCE' } })
  await assert.rejects(service.reverseMovement(rt.db, opening.id, rt.admin.id, 'QA'), { status: 409 })
  await assert.rejects(rt.db.product.update({ where: { id: p.id }, data: { stock: 999 } }))
  assert.equal(await stock(p.id), 5)
})

const checkout = p => ({ customer: { nombre: 'QA', apellido: 'Test', correo: 'qa@example.test', celular: '999999999' }, delivery: { tipoEntrega: 'recojo', departamento: 'Lima', provincia: 'Lima', distrito: 'Lima' }, items: [{ productId: p.id, quantity: 1 }] })
test('Pedidos web pendientes: reserva, reintentos, pago y cancelacion concurrente', async () => {
  const p = await rt.product(2), key = randomUUID(), body = checkout(p)
  const results = await Promise.all([1,2].map(() => orders.createOrder(rt.db, body, null, key, 'qa-only-secret')))
  assert.equal(results[0].order.id, results[1].order.id); assert.equal(await stock(p.id), 1)
  const order = results[0].order
  assert.equal(order.status, 'PENDING')
  await orders.changeOrderStatus(rt.db, order.id, 'CONFIRMED', 'QA', rt.admin.id)
  await orders.changeOrderStatus(rt.db, order.id, 'PAID', 'QA', rt.admin.id)
  assert.equal(await stock(p.id), 1)
  const reservation = await rt.db.inventoryMovement.findFirst({ where: { productId: p.id, type: 'WEB_ORDER' } })
  await assert.rejects(service.reverseMovement(rt.db, reservation.id, rt.admin.id, 'QA'), { status: 409 })
  await Promise.all([1,2].map(() => orders.changeOrderStatus(rt.db, order.id, 'CANCELLED', 'QA', rt.admin.id)))
  assert.equal(await stock(p.id), 2)
  assert.equal(await rt.db.inventoryMovement.count({ where: { productId: p.id, type: 'WEB_CANCELLATION' } }), 1)
})

test('Dos compradores para ultima unidad; pedido fallido se revierte completo', async () => {
  const p = await rt.product(1)
  const results = await Promise.allSettled([1,2].map(() => orders.createOrder(rt.db, checkout(p), null, randomUUID(), 'qa-secret')))
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(await stock(p.id), 0)
  assert.equal(await rt.db.orderItem.count({ where: { productId: p.id } }), 1)
  assert.equal(await rt.db.inventoryMovement.count({ where: { productId: p.id, type: 'WEB_ORDER' } }), 1)
})

test('Editor de producto exige motivo y registra diferencia sin costo historico', async () => {
  const p = await rt.product(3), path = '/api/admin/products/' + p.id
  assert.equal((await api(path, { method: 'PATCH', user: rt.admin, body: { stock: 8 } })).status, 400)
  assert.equal(await stock(p.id), 3)
  assert.equal((await api(path, { method: 'PATCH', user: rt.admin, body: { stock: 8, expectedStock: 3, stockReason: 'Conteo QA' } })).status, 200)
  assert.equal(await stock(p.id), 8)
  const m = await rt.db.inventoryMovement.findFirst({ where: { productId: p.id, type: 'POSITIVE_ADJUSTMENT' } })
  assert.equal(m.quantity, 5); assert.equal(m.unitCost, null)
  assert.equal((await api(path, { method: 'PATCH', user: rt.admin, body: { stock: 4, expectedStock: 3, stockReason: 'Editor obsoleto' } })).status, 409)
  assert.equal(await stock(p.id), 8)
})

test('Kardex filtrable y CSV seguro; lectura persiste en solicitudes nuevas', async () => {
  const p = await rt.product(4), d = await service.createDraftMovement(rt.db, draft(p, { reason: '=FORMULA()' }))
  await service.confirmDraftMovement(rt.db, d.id, rt.warehouse.id)
  const query = '?productId=' + p.id + '&type=PURCHASE&userId=' + rt.admin.id + '&from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z'
  const list = await inv('/movements' + query, { user: rt.cashier })
  assert.equal(list.status, 200); assert.equal(list.data.total, 1); assert.equal(list.data.rows[0].balanceAfter, 6)
  const csv = await inv('/movements/export.csv' + query, { user: rt.cashier })
  assert.equal(csv.status, 200); assert.ok(csv.data.includes("'=FORMULA()")); assert.ok(csv.data.includes(p.sku))
  assert.equal((await inv('/lookup?code=' + p.sku, { user: rt.cashier })).data.stock, 6)
})

test('Upgrade con cantidades existentes: saldo inicial una vez y cancelacion heredada', async () => {
  const sql = input => runDocker(['exec','-i',rt.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','qa_final_home','-d','qa_inventory_upgrade'], { input })
  runDocker(['exec',rt.container,'createdb','-U','qa_final_home','qa_inventory_upgrade'])
  const migrations = join(rt.root, 'server/prisma/migrations')
  for (const name of readdirSync(migrations).sort().filter(n => /^\d/.test(n) && n < '20261017000000_inventory_part1')) sql(readFileSync(join(migrations,name,'migration.sql'),'utf8'))
  sql(`INSERT INTO categories(id,slug,name) VALUES ('qa-c','qa-c','QA');
    INSERT INTO products(id,slug,name,price,stock,tags,"categoryId","updatedAt") VALUES ('qa-p','qa-p','QA',10,7,'{}','qa-c',NOW()),('qa-zero','qa-zero','QA',1,0,'{}','qa-c',NOW());`)
  sql(`INSERT INTO orders(id,"customerNombre","customerApellido","customerCorreo","customerCelular","deliveryType",departamento,provincia,distrito,subtotal,total,"updatedAt")
    VALUES ('qa-legacy-order','QA','QA','qa@example.test','999999999','PICKUP','QA','QA','QA',30,30,NOW());
    INSERT INTO order_items(id,"orderId","productId",name,quantity,"unitPrice") VALUES ('qa-legacy-item','qa-legacy-order','qa-p','QA',3,10);`)
  sql(readFileSync(join(migrations, '20261017000000_inventory_part1/migration.sql'),'utf8'))
  assert.equal(sql(`SELECT stock FROM products WHERE id='qa-p'`), '7')
  assert.equal(sql(`SELECT count(*) FROM inventory_movements WHERE type='INITIAL_BALANCE'`), '2')
  assert.equal(sql(`SELECT count(*) FROM inventory_movements WHERE "unitCost" IS NOT NULL`), '0')
  assert.equal(sql(`SELECT sum(quantity) FROM inventory_movements`), '7')
  assert.throws(() => sql(`INSERT INTO inventory_movements SELECT 'qa-duplicate',"productId",type,direction,status,quantity,"balanceAfter",reason,reference,supplier,"unitCost","occurredAt","createdAt","confirmedAt","createdById","confirmedById",NULL,NULL FROM inventory_movements LIMIT 1`))
  for (const name of readdirSync(migrations).sort().filter(n => /^\d/.test(n) && n > '20261017000000_inventory_part1')) sql(readFileSync(join(migrations,name,'migration.sql'),'utf8'))
  const url = new URL(process.env.DATABASE_URL); url.pathname = '/qa_inventory_upgrade'
  const legacyDb = new rt.db.constructor({ datasources: { db: { url: url.toString() } } })
  try {
    await orders.changeOrderStatus(legacyDb, 'qa-legacy-order', 'CANCELLED', 'QA')
    await orders.changeOrderStatus(legacyDb, 'qa-legacy-order', 'CANCELLED', 'QA')
    assert.equal((await legacyDb.product.findUnique({ where: { id: 'qa-p' } })).stock, 10)
    assert.equal(await legacyDb.inventoryMovement.count({ where: { type: 'WEB_CANCELLATION' } }), 1)
  } finally { await legacyDb.$disconnect() }
})

test('Clave de origen concurrente aplica un solo ingreso y rechaza otra operacion', async () => {
  const p = await rt.product(2)
  const input = { productId: p.id, type: 'PURCHASE', direction: 'IN', quantity: 3, reason: 'QA', sourceKey: 'qa-source-' + p.id }
  const results = await Promise.all([1,2].map(() => rt.db.$transaction(tx => service.recordConfirmedMovement(tx, input))))
  assert.equal(results.filter(x => x.replayed).length, 1); assert.equal(await stock(p.id), 5)
  await assert.rejects(rt.db.$transaction(tx => service.recordConfirmedMovement(tx, { ...input, quantity: 4 })), { status: 409 })
})

test('Pedido de varias lineas falla entero y reversion sin stock queda sin aplicar', async () => {
  const a = await rt.product(1), b = await rt.product(0)
  const body = checkout(a); body.items.push({ productId: b.id, quantity: 1 })
  await assert.rejects(orders.createOrder(rt.db, body, null, randomUUID(), 'qa-secret'), { code: 'ORDER_REJECTED' })
  assert.equal(await stock(a.id), 1); assert.equal(await rt.db.orderItem.count({ where: { productId: a.id } }), 0)
  const d = await service.createDraftMovement(rt.db, draft(a))
  await service.confirmDraftMovement(rt.db, d.id, rt.admin.id)
  const loss = await service.createDraftMovement(rt.db, draft(a, { type: 'LOSS', direction: 'OUT', quantity: 3 }))
  await service.confirmDraftMovement(rt.db, loss.id, rt.admin.id)
  await assert.rejects(service.reverseMovement(rt.db, d.id, rt.admin.id, 'QA'), { status: 409 })
  assert.equal(await stock(a.id), 0)
  assert.equal(await rt.db.inventoryMovement.count({ where: { reversalOfId: d.id } }), 0)
})

test('Esquema Prisma y migraciones coinciden en la base desechable', () => {
  const schemaPath = join(rt.tempRoot, 'schema/schema.prisma')
  const result = runPrisma({ root: rt.root, tempRoot: rt.tempRoot, schemaPath, dotenvPath: join(rt.tempRoot, 'qa-empty-dotenv'), databaseUrl: process.env.DATABASE_URL,
    args: ['migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', schemaPath, '--exit-code'] })
  assert.match(result, /No difference detected/)
})
