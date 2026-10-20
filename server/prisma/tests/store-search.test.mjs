import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
import { normalizeSearch, matchesSearch } from '../../../src/utils/searchText.js'
import { runPrisma } from './helpers/isolated-runtime.mjs'
import { join } from 'node:path'

let rt, base, product, brand, category, limiter
before(async () => {
  rt = await createInventoryRuntime()
  limiter = (await rt.load('server/src/routes/storeSearch.routes.js')).suggestionLimit
  category = await rt.db.category.create({ data: { slug: 'audio-sintetico-qa', name: 'Electrónica Ñandú QA' } })
  brand = await rt.db.brand.create({ data: { slug: 'marca-sintetica-qa', name: 'Marca Élite QA' } })
  product = await rt.product(4, { name: 'Audífonos Inalámbricos QA', category: category.slug, brandId: brand.id })
  base = await rt.start()
}, { timeout: 180000 })
after(async () => { await rt?.close() })
const get = async path => { const response = await fetch(base + path); return { status: response.status, body: await response.json() } }
test('SQL y cliente ignoran tildes, mayúsculas, espacios y combinaciones Unicode', async () => {
  for (const value of [' ÁÚDÍFONOS ÑANDÚ ', 'A\u0301udi\u0301fonos  ÉLITE', 'Electrónica Inalámbricos']) {
    const [row] = await rt.db.$queryRaw`SELECT store_normalize_search(${value}) AS normalized`
    assert.equal(row.normalized, normalizeSearch(value))
  }
  const row = await rt.db.product.findUnique({ where: { id: product.id } })
  for (const query of ['AUDIFONOS', 'inalambricos', 'elite', 'electronica', 'ñandú', 'élite audífonos']) assert.equal(matchesSearch(row, query), true)
  for (const query of ['AUDIFONOS', 'elite', 'electronica', 'élite audífonos']) {
    const result = await get('/api/products?q=' + encodeURIComponent(query))
    assert.equal(result.status, 200)
    assert.ok(result.body.some(row => row.id === product.id))
  }
})
test('sugerencias limitadas, datos mínimos y entidades visibles; no revelan campos de detalle', async () => {
  const p = await get('/api/search/suggestions?q=audifonos')
  assert.equal(p.status, 200)
  assert.ok(p.body.items.some(row => row.kind === 'Producto' && row.label === product.name))
  assert.ok(p.body.items.length <= 8)
  assert.equal(p.body.items[0].stock, undefined)
  assert.equal(p.body.items[0].description, undefined)
  assert.ok((await get('/api/search/suggestions?q=electronica')).body.items.some(row => row.kind === 'Categoría'))
  assert.ok((await get('/api/search/suggestions?q=elite')).body.items.some(row => row.kind === 'Marca'))
  const parent = await rt.db.category.create({ data: { name: 'Padre oculto QA', slug: 'padre-oculto-qa', visible: false } })
  await rt.db.category.create({ data: { name: 'Oculta coincidente QA', slug: 'oculta-qa', parentId: parent.id } })
  assert.equal((await get('/api/search/suggestions?q=oculta')).body.items.some(row => row.kind === 'Categoría'), false)
  await rt.db.brand.update({ where: { id: brand.id }, data: { visible: false } })
  assert.equal((await get('/api/search/suggestions?q=elite')).body.items.some(row => row.kind === 'Marca'), false)
  await rt.db.brand.update({ where: { id: brand.id }, data: { visible: true } })
})
test('renombrar marca/categoría actualiza búsqueda sin cambiar existencias ni originales', async () => {
  const before = await rt.db.product.findUnique({ where: { id: product.id } })
  await rt.db.brand.update({ where: { id: brand.id }, data: { name: 'Marca Única Sintética QA' } })
  await rt.db.category.update({ where: { id: category.id }, data: { name: 'Tecnología Nueva QA' } })
  const after = await rt.db.product.findUnique({ where: { id: product.id } })
  assert.equal(after.stock, before.stock)
  assert.equal(after.name, before.name)
  assert.equal(after.brand, before.brand)
  assert.ok(after.searchText.includes('unica sintetica'))
  assert.ok(after.searchText.includes('tecnologia nueva'))
  assert.ok((await get('/api/products?q=tecnologia')).body.some(row => row.id === product.id))
})
test('consulta corta/vacía sin resultados, validación y límite por IP', async () => {
  assert.deepEqual((await get('/api/search/suggestions?q=aa')).body, { items: [] })
  assert.equal((await get('/api/search/suggestions?q=' + 'a'.repeat(81))).status, 400)
  assert.equal((await get('/api/products?q=' + 'a'.repeat(81))).status, 400)
  limiter.resetKey('127.0.0.1')
  for (let i = 0; i < 120; i++) assert.equal((await get('/api/search/suggestions?q=')).status, 200)
  assert.equal((await get('/api/search/suggestions?q=')).status, 429)
})
test('índices de búsqueda presentes y Prisma sin deriva', async () => {
  const indexes = await rt.db.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_store_search_idx'`
  assert.equal(indexes.length, 3)
  const schemaPath = join(rt.tempRoot, 'schema/schema.prisma')
  assert.match(runPrisma({ root: rt.root, tempRoot: rt.tempRoot, schemaPath, dotenvPath: process.env.DOTENV_CONFIG_PATH,
    databaseUrl: process.env.DATABASE_URL, args: ['migrate','diff','--from-schema-datasource',schemaPath,'--to-schema-datamodel',schemaPath,'--script','--exit-code'] }), /empty migration/)
})
