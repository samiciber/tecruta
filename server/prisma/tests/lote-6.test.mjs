// Synthetic records and loopback HTTP/PostgreSQL only; no external providers.
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, randomUUID } from 'node:crypto'
import express from '../../node_modules/express/index.js'
import { createEmptyDotenv, createPrismaWorkspace, runDocker, runPrisma } from './helpers/isolated-runtime.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const source = process.env.TECRUTA_QA_MIGRATIONS_DIR || join(root, 'server/prisma/migrations')
const container = `tecruta-lote6-test-${process.pid}`
const temp = mkdtempSync(join(tmpdir(), 'tecruta-lote6-'))
const dotenvPath = createEmptyDotenv(temp)
const schema = join(root, 'server/prisma/schema.prisma')
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
let workspace, started, server, db, base, tokens
function docker(...args) { return runDocker(args) }
async function request(path, { method = 'GET', body, user = 'admin' } = {}) {
  const res = await fetch(base + '/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokens[user]}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const post = (path, body, user) => request('admin/' + path, { method: 'POST', body, user })
const patch = (path, body, user) => request('admin/' + path, { method: 'PATCH', body, user })
const body = extra => ({ slug: 'qa-' + randomUUID(), name: 'QA producto', category: 'qa-category', price: 19.9, stock: 3, ...extra })
async function create(extra = {}) {
  const result = await post('products', body(extra)); assert.equal(result.status, 201, JSON.stringify(result.data)); return result.data
}
async function assertPair(product, brandId, name) {
  const row = await db.product.findUnique({ where: { id: product.id } })
  assert.equal(row.brandId, brandId); assert.equal(row.brand, name); assert.equal(product.brand, name)
  assert.equal(product.brandSlug, brandId ? (await db.brand.findUnique({ where: { id: brandId } })).slug : null)
}
before(async () => {
  assert.ok(existsSync(join(source, '20261012000000_add_nav_brands_stores_saved_items/migration.sql')), 'Integra Lote 2 o proporciona su SQL intacto mediante TECRUTA_QA_MIGRATIONS_DIR.')
  docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=qa_lote6', '--env', 'POSTGRES_DB=qa_lote6', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image); started = true
  process.env.DOTENV_CONFIG_PATH = dotenvPath; process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = `postgresql://qa_lote6@${docker('port', container, '5432/tcp')}/qa_lote6`
  process.env.JWT_SECRET = randomBytes(32).toString('hex')
  let ready = false
  for (let i = 0; i < 40; i++) { try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'qa_lote6'); ready = true; break } catch {} await new Promise(resolve => setTimeout(resolve, 250)) }
  assert.ok(ready)
  workspace = createPrismaWorkspace({ tempRoot: temp, name: 'prisma', schemaSource: schema, migrationsSource: source })
  runPrisma({ root, tempRoot: temp, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl: process.env.DATABASE_URL,
    args: ['migrate', 'deploy', '--schema', workspace.schemaPath] })
  db = (await import('../../src/lib/prisma.js')).prisma
  const { signToken } = await import('../../src/lib/token.js'); tokens = {}
  for (const [id, role] of [['admin', 'ADMIN'], ['client', 'CUSTOMER']]) {
    await db.user.create({ data: { id: 'qa-' + id, email: `qa-${id}@example.invalid`, passwordHash: 'qa-not-a-login-hash', nombre: 'QA', apellido: id, role, verified: true } }); tokens[id] = signToken({ sub: 'qa-' + id })
  }
  await db.category.create({ data: { id: 'qa-category', slug: 'qa-category', name: 'QA categoría', legacy: true } })
  for (const [id, slug, name, visible] of [['qa-a','qa-a','UGREEN',true],['qa-b','qa-b','QA Segunda',true],['qa-hidden','qa-hidden','QA Oculta',false],['qa-duplicate-1','qa-d1','QA Duplicada',true],['qa-duplicate-2','qa-d2','qa duplicada',true],['qa-rename','qa-rename','QA Antes',true]]) await db.brand.create({ data: { id, slug, name, visible } })
  await db.paymentMethod.create({ data: { id: 'qa-payment', key: 'qa-payment', label: 'QA pago', config: { phone: '000000000' } } })
  const { adminRouter } = await import('../../src/routes/admin.routes.js')
  const { productsRouter } = await import('../../src/routes/products.routes.js')
  const { errorHandler, asyncHandler } = await import('../../src/middleware/errorHandler.js')
  const app = express(); app.set('trust proxy', 0); app.use(express.json({ limit: '100kb' }))
  app.use('/api/admin', adminRouter); app.use('/api/products', productsRouter)
  app.patch('/api/qa/missing', asyncHandler(async () => { await db.product.update({ where: { id: 'qa-does-not-exist' }, data: { stock: 0 } }) }))
  app.use(errorHandler)
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve)); if (db) await db.$disconnect()
  if (started) docker('rm', '--force', '--volumes', container)
  rmSync(temp, { recursive: true, force: true })
})
test('ADMIN gate precedes validation and writes for products, categories and payments', async () => {
  for (const [path, method] of [['products','POST'],['categories','POST'],['payment-methods/qa-payment','PATCH']]) for (const [user,status] of [[null,401],['client',403]]) assert.equal((await request('admin/'+path,{method,body:{},user})).status,status)
  assert.equal(await db.product.count(),0)
})
test('invalid product requests return Spanish 400 issues and never write', async () => {
  const before = await db.product.count()
  for (const extra of [{price:-1},{price:'19.9'},{price:0.001},{stock:1.2},{stock:-1},{stock:null},{featured:'false'},{images:['']},{tags:1},{role:'ADMIN'},{image:'javascript:alert(1)'},{specifications:{}}]) {
    const result = await post('products',body(extra)); assert.equal(result.status,400); assert.ok(result.data.issues.length)
  }
  assert.match((await post('products',body({price:-1}))).data.error,/importe no puede ser negativo/)
  assert.equal(await db.product.count(),before)
})
test('creation resolves names and returns the exact public DTO/filter membership', async () => {
  const product = await create({brand:' ugreen ',price:0,stock:0,images:['/qa-1.png','/qa-2.png'],specifications:[{label:'Modelo',value:'QA'}],hotspots:null})
  await assertPair(product,'qa-a','UGREEN'); assert.equal(product.price,0); assert.equal(product.stock,0)
  assert.deepEqual((await request('products/'+product.slug)).data,product)
  assert.ok((await request('products?brand=qa-a')).data.some(p=>p.id===product.id))
})
test('creation accepts explicit/hidden IDs, no brand and nullable optional data', async () => {
  await assertPair(await create({brandId:'qa-hidden',compareAtPrice:null,description:'',image:'',specifications:null,hotspots:[{id:'qa-h',x:0,y:1,z:2,title:'QA',description:''}]}),'qa-hidden','QA Oculta')
  await assertPair(await create({brandId:'qa-duplicate-1',brand:'qa duplicada'}),'qa-duplicate-1','QA Duplicada')
  await assertPair(await create({brand:null}),null,null)
  const minimal = await post('products',{slug:'qa-minimal',name:'QA mínimo',category:'qa-category',price:0}); assert.equal(minimal.status,201); assert.equal(minimal.data.stock,0); assert.deepEqual(minimal.data.tags,[])
})
test('unknown, ambiguous or conflicting brands and absent categories cannot create records', async () => {
  const beforeProducts = await db.product.count(), beforeBrands = await db.brand.count()
  for (const extra of [{brand:'QA inexistente'},{brand:'QA Duplicada'},{brandId:'qa-absent'},{brandId:'qa-a',brand:'QA Segunda'},{brandId:null,brand:'UGREEN'},{category:'qa-absent'}]) assert.equal((await post('products',body(extra))).status,400)
  assert.equal(await db.product.count(),beforeProducts); assert.equal(await db.brand.count(),beforeBrands)
})
test('patch changes and clears both brand columns, preserving other fields and DTO parity', async () => {
  const original = await create({brandId:'qa-a',images:['/qa-old.png']})
  const changed = await patch('products/'+original.id,{brand:'QA Segunda'}); assert.equal(changed.status,200); await assertPair(changed.data,'qa-b','QA Segunda')
  assert.equal(changed.data.price,original.price); assert.deepEqual(changed.data.images,original.images)
  assert.deepEqual((await request('products/'+original.slug)).data,changed.data)
  assert.ok(!(await request('products?brand=qa-a')).data.some(p=>p.id===original.id))
  await assertPair((await patch('products/'+original.id,{brand:''})).data,null,null)
  await assertPair((await patch('products/'+original.id,{brandId:'qa-a'})).data,'qa-a','UGREEN')
  await assertPair((await patch('products/'+original.id,{brandId:null})).data,null,null)
})
test('editing reconciles old text with its relation/name; unknown legacy text requires explicit repair', async () => {
  const original = await create({brandId:'qa-a'})
  await db.product.update({where:{id:original.id},data:{brand:'QA stale text'}})
  await assertPair((await patch('products/'+original.id,{stock:5})).data,'qa-a','UGREEN')
  await db.product.update({where:{id:original.id},data:{brandId:null,brand:'ugreen'}})
  await assertPair((await patch('products/'+original.id,{price:20})).data,'qa-a','UGREEN')
  await db.product.update({where:{id:original.id},data:{brandId:null,brand:'QA unknown legacy'}})
  assert.equal((await patch('products/'+original.id,{stock:8})).status,400)
  assert.equal((await db.product.findUnique({where:{id:original.id}})).stock,5)
  await assertPair((await patch('products/'+original.id,{brand:null})).data,null,null)
})
test('duplicate slug returns 409 and failed full edit leaves images, brand and price intact', async () => {
  const first = await create({brandId:'qa-a',images:['/qa-original.png']}), second = await create()
  const duplicate = await post('products',body({slug:first.slug})); assert.equal(duplicate.status,409); assert.deepEqual(Object.keys(duplicate.data),['error'])
  assert.equal((await patch('products/'+first.id,{slug:second.slug,brandId:'qa-b',price:1,images:['/qa-replacement.png']})).status,409)
  assert.deepEqual((await request('products/'+first.slug)).data,first)
  const valid = await patch('products/'+first.id,{images:[],compareAtPrice:0,featured:false}); assert.equal(valid.status,200); assert.deepEqual(valid.data.images,[]); assert.equal(valid.data.compareAtPrice,0)
})
test('categories/payments validate before writes and duplicates/missing records map to 409/404', async () => {
  assert.equal((await post('categories',{slug:'qa-new',name:' QA nueva '})).status,201)
  assert.equal((await post('categories',{slug:'qa-new',name:'QA duplicada'})).status,409)
  assert.equal((await post('categories',{slug:'qa-invalid',name:1})).status,400)
  for (const value of [{name:''},{slug:'qa-renamed'},{name:false},{}]) assert.equal((await patch('categories/qa-new',value)).status,400)
  assert.equal((await patch('categories/qa-new',{name:'QA editada',description:null})).data.name,'QA editada')
  assert.equal((await patch('categories/qa-absent',{name:'QA'})).status,404)
  assert.equal((await patch('payment-methods/qa-payment',{active:'false'})).status,400)
  assert.equal((await db.paymentMethod.findUnique({where:{id:'qa-payment'}})).active,true)
  assert.equal((await patch('payment-methods/qa-payment',{config:[]})).status,400)
  const changed = await patch('payment-methods/qa-payment',{active:false,label:'QA actualizado',config:{phone:'000000001'}}); assert.equal(changed.status,200); assert.equal(changed.data.active,false); assert.deepEqual(changed.data.config,{phone:'000000001'})
  assert.equal((await patch('payment-methods/qa-absent',{active:false})).status,404)
  assert.equal((await request('qa/missing',{method:'PATCH',body:{}})).status,404)
})
test('deletion returns 409 for real foreign keys, 204 after unlinking and 404 when missing', async () => {
  const product = await create(), cart = await db.cart.create({data:{userId:'qa-client'}})
  await db.cartItem.create({data:{cartId:cart.id,productId:product.id,quantity:1}})
  assert.equal((await request('admin/products/'+product.id,{method:'DELETE'})).status,409)
  assert.ok(await db.product.findUnique({where:{id:product.id}}))
  await db.cartItem.deleteMany({where:{cartId:cart.id}})
  assert.equal((await request('admin/products/'+product.id,{method:'DELETE'})).status,204)
  assert.equal((await request('admin/products/'+product.id,{method:'DELETE'})).status,404)
})
test('concurrent product patches preserve coherent brand pairs and fields omitted by the other edit', async () => {
  const original = await create({brandId:'qa-a'})
  const results = await Promise.all([patch('products/'+original.id,{brandId:'qa-b',price:22}),patch('products/'+original.id,{brandId:'qa-a',stock:7})])
  for (const result of results) { assert.equal(result.status,200); assert.equal(result.data.brand,result.data.brandSlug==='qa-a'?'UGREEN':'QA Segunda') }
  const row = await db.product.findUnique({where:{id:original.id},include:{brandRef:true}}); assert.equal(row.brand,row.brandRef.name); assert.equal(Number(row.price),22); assert.equal(row.stock,7)
})
test('brand rename while the product waits on its lock is read again before storing its name', async () => {
  const original = await create({brandId:'qa-rename'})
  let release, notify; const hold = new Promise(resolve=>release=resolve), locked = new Promise(resolve=>notify=resolve)
  const rename = db.$transaction(async tx=>{ await tx.$queryRaw`SELECT id FROM brands WHERE id = 'qa-rename' FOR UPDATE`; notify(); await hold; await tx.brand.update({where:{id:'qa-rename'},data:{name:'QA Después'}}) })
  await locked; const pending = patch('products/'+original.id,{brandId:'qa-rename',stock:4})
  let waiting = false
  try {
    for (let i=0;i<100;i++) { const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT id FROM brands%'`; if(rows.length){waiting=true;break} await new Promise(resolve=>setTimeout(resolve,10)) }
  } finally { release() }
  await rename; const result = await pending; assert.ok(waiting); assert.equal(result.status,200); await assertPair(result.data,'qa-rename','QA Después')
})
