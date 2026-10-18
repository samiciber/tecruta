import { createFinalHomeRuntime } from './final-home-runtime.mjs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
export async function createInventoryRuntime({ appOptions } = {}) {
  const runtime = await createFinalHomeRuntime()
  const load = path => import(pathToFileURL(join(runtime.root, path)))
  const { prisma } = await load('server/src/lib/prisma.js')
  for (const key of Object.keys(runtime.db)) {
    if (key.startsWith('_') || key.startsWith('$') || !runtime.db[key]?.findMany) continue
    prisma[key] = runtime.db[key]
  }
  const { createApp } = await load('server/src/index.js')
  const app = createApp(appOptions ? await appOptions(runtime) : {})
  let server
  const start = async () => {
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    return 'http://127.0.0.1:' + server.address().port
  }
  const close = async () => { if (server) await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); await runtime.close() }
  const { createAdminProduct } = await load('server/src/lib/adminProducts.js')
  const category = await runtime.db.category.create({ data: { slug: 'qa-inventory', name: 'Inventario sintético QA' } })
  const warehouse = await runtime.db.user.create({ data: { email: 'qa-warehouse@example.test', passwordHash: 'synthetic', nombre: 'QA', apellido: 'Almacén', role: 'WAREHOUSE', verified: true } })
  const cashier = await runtime.db.user.create({ data: { email: 'qa-cashier@example.test', passwordHash: 'synthetic', nombre: 'QA', apellido: 'Caja', role: 'CASHIER', verified: true } })
  let sequence = 0
  const product = (stock = 10, extra = {}) => createAdminProduct(runtime.db, {
    slug: 'qa-inventory-' + ++sequence, name: 'Producto sintético ' + sequence, category: category.slug,
    price: 19.9, stock, stockReason: 'Existencias sintéticas QA', ...extra,
  }, runtime.admin.id)
  return { ...runtime, start, close, warehouse, cashier, product, load }
}
