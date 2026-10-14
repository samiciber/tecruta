// Own disposable PostgreSQL + loopback HTTP; never contacts a receipt provider.
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import express from '../../node_modules/express/index.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const source = process.env.TECRUTA_QA_MIGRATIONS_DIR || join(root,'server/prisma/migrations')
const container = `tecruta-lote9-test-${process.pid}`
const temp = mkdtempSync(join(tmpdir(),'tecruta-lote9-'))
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')
let started, db, server, base, tokens, reads = 0
const nativeFetch = globalThis.fetch
const run = (cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',stdio:'pipe',...options}).trim()
function docker(...args) {
  const env = {...process.env}
  for (const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key]
  return run('docker',['--host=unix:///var/run/docker.sock',...args],{env})
}
async function request(path, user='a') {
  const response = await nativeFetch(base+'/api/orders'+path,{headers:user?{Authorization:`Bearer ${tokens[user] || 'qa-invalid-session'}`}:{}})
  const type = response.headers.get('content-type') || ''
  return {status:response.status,headers:response.headers,data:type.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer())}
}
const orderData = (id,userId,extra={})=>({id,userId,customerNombre:'QA',customerApellido:id,customerCorreo:'qa@example.invalid',customerCelular:'000000000',
  deliveryType:'SHIPPING',departamento:'QA',provincia:'QA',distrito:'QA',subtotal:10,savings:0,total:10,...extra})
before(async()=>{
  assert.ok(existsSync(join(source,'20261012000000_add_nav_brands_stores_saved_items/migration.sql')),'Integra Lote 2 o proporciona su SQL intacto con TECRUTA_QA_MIGRATIONS_DIR.')
  docker('run','--detach','--name',container,'--publish','127.0.0.1::5432','--env','POSTGRES_USER=qa_lote9','--env','POSTGRES_DB=qa_lote9','--env','POSTGRES_HOST_AUTH_METHOD=trust',image);started=true
  process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test'
  process.env.DATABASE_URL=`postgresql://qa_lote9@${docker('port',container,'5432/tcp')}/qa_lote9`
  process.env.JWT_SECRET=randomBytes(32).toString('hex')
  let ready=false
  for(let i=0;i<40;i++){try{docker('exec',container,'pg_isready','-h','127.0.0.1','-U','qa_lote9');ready=true;break}catch{}await new Promise(resolve=>setTimeout(resolve,250))}
  assert.ok(ready)
  cpSync(join(root,'server/prisma/schema.prisma'),join(temp,'schema.prisma'));cpSync(source,join(temp,'migrations'),{recursive:true})
  run(join(root,'server/node_modules/.bin/prisma'),['migrate','deploy','--schema',join(temp,'schema.prisma')],{cwd:temp,env:{...process.env}})
  db=(await import('../../src/lib/prisma.js')).prisma
  const {signToken}=await import('../../src/lib/token.js');tokens={}
  for(const [id,role] of [['a','CUSTOMER'],['b','CUSTOMER'],['admin','ADMIN']]){
    await db.user.create({data:{id:'qa-'+id,email:`qa-${id}@example.invalid`,passwordHash:'qa-not-a-login-hash',nombre:'QA',apellido:id,role,verified:true}})
    tokens[id]=signToken({sub:'qa-'+id,tokenVersion:0})
  }
  await db.category.create({data:{id:'qa-category',slug:'qa-category',name:'QA category',legacy:true}})
  await db.product.create({data:{id:'qa-product',slug:'qa-product',name:'QA historical item',categoryId:'qa-category',price:99,stock:7,tags:[]}})
  await db.order.create({data:orderData('qa-order-a','qa-a',{status:'PAID',receiptUrl:'https://res.cloudinary.com/qa-test/image/upload/v1/a.png',createdAt:new Date('2026-10-12T00:00:00Z'),
    items:{create:{productId:'qa-product',name:'QA snapshot name',quantity:2,unitPrice:5}},statusHistory:{create:[
      {id:'qa-ev-3',status:'PAID',createdAt:new Date('2026-10-12T17:00:00Z'),note:'QA internal note'},
      {id:'qa-ev-1',status:'PENDING',createdAt:new Date('2026-10-12T16:00:00Z')},
      {id:'qa-ev-2',status:'CONFIRMED',createdAt:new Date('2026-10-12T17:00:00Z')},
    ]}})})
  await db.order.create({data:orderData('qa-old-a','qa-a',{createdAt:new Date('2026-10-11T00:00:00Z')})})
  await db.order.create({data:orderData('qa-order-b','qa-b',{receiptUrl:'https://res.cloudinary.com/qa-test/raw/upload/v1/b.pdf'})})
  await db.order.create({data:orderData('qa-guest',null,{receiptUrl:'https://res.cloudinary.com/qa-test/image/upload/v1/guest.png'})})
  const routes=await import('../../src/routes/orders.routes.js')
  const {errorHandler}=await import('../../src/middleware/errorHandler.js')
  globalThis.fetch=async value=>{
    const url=String(value)
    assert.equal(new URL(url).hostname,'res.cloudinary.com','Unexpected outbound provider request')
    reads++;return new Response(url.endsWith('.pdf')?'%PDF-1.7 QA local PDF':png,{headers:{'content-type':url.endsWith('.pdf')?'application/pdf':'image/png'}})
  }
  const app=express();app.set('trust proxy',0)
  app.use('/api/orders',routes.createOrdersRouter?routes.createOrdersRouter({db}):routes.ordersRouter)
  app.use((_req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));app.use(errorHandler)
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`
})
after(async()=>{
  globalThis.fetch=nativeFetch
  if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.$disconnect()
  if(started)docker('rm','--force','--volumes',container)
  rmSync(temp,{recursive:true,force:true})
})
test('owner list ignores userId/orderId query overrides and excludes other users and guests',async()=>{
  for(const suffix of ['', '?userId=qa-b&orderId=qa-order-b', '?userId=qa-admin', '?userId=null']){
    const result=await request('/me'+suffix);assert.equal(result.status,200);assert.deepEqual(result.data.map(o=>o.id),['qa-order-a','qa-old-a'])
    assert.equal(result.headers.get('cache-control'),'private, no-store')
  }
  assert.deepEqual((await request('/me','b')).data.map(o=>o.id),['qa-order-b'])
  assert.deepEqual((await request('/me','admin')).data,[])
})
test('history is chronological with deterministic ties; internal notes/URLs stay private',async()=>{
  const order=(await request('/me')).data[0]
  assert.deepEqual(order.statusHistory.map(e=>e.id),['qa-ev-1','qa-ev-2','qa-ev-3'])
  assert.deepEqual(order.statusHistory.map(e=>e.status),['PENDING','CONFIRMED','PAID'])
  assert.equal(order.hasReceipt,true);assert.ok(!Object.hasOwn(order,'receiptUrl'))
  assert.ok(!JSON.stringify(order).includes('QA internal note'));assert.ok(!JSON.stringify(order).includes('res.cloudinary.com'))
  assert.equal(order.items[0].name,'QA snapshot name');assert.equal(order.items[0].unitPrice,5);assert.equal(order.total,10)
  assert.deepEqual((await request('/me')).data[1].statusHistory,[])
})
test('receipt by ID denies another customer, ADMIN non-owner, guest order, missing order and no file before downloading',async()=>{
  const before=reads
  for(const [id,user] of [['qa-order-a','b'],['qa-order-a','admin'],['qa-order-b','a'],['qa-guest','a'],['qa-missing','a'],['qa-old-a','a']]){
    const result=await request('/me/'+id+'/receipt',user);assert.equal(result.status,404);assert.deepEqual(result.data,{error:'Comprobante no encontrado.'})
  }
  assert.equal(reads,before)
})
test('anonymous and invalid sessions cannot list orders or download a known receipt',async()=>{
  const before=reads
  for(const user of [null,'invalid'])for(const path of ['/me','/me/qa-order-a/receipt']){
    const result=await request(path,user);assert.equal(result.status,401);assert.equal(result.headers.get('cache-control'),'private, no-store')
  }
  assert.equal(reads,before)
})
test('owner gets only the PNG/PDF bytes with private cache and safe file headers',async()=>{
  const before=reads
  const a=await request('/me/qa-order-a/receipt');assert.equal(a.status,200);assert.deepEqual(a.data,png)
  assert.equal(a.headers.get('content-type'),'image/png');assert.equal(a.headers.get('cache-control'),'private, no-store')
  assert.equal(a.headers.get('x-content-type-options'),'nosniff');assert.match(a.headers.get('content-disposition'),/attachment; filename="comprobante.png"/)
  const b=await request('/me/qa-order-b/receipt','b');assert.equal(b.status,200);assert.equal(b.headers.get('content-type'),'application/pdf');assert.match(b.data.toString(),/^%PDF-/)
  assert.equal(reads,before+2)
})
test('read endpoints leave orders, stock, receipts and history unchanged',async()=>{
  assert.equal(await db.order.count(),4);assert.equal(await db.orderStatusHistory.count(),3)
  assert.equal((await db.product.findUnique({where:{id:'qa-product'}})).stock,7)
  assert.equal((await db.order.findUnique({where:{id:'qa-order-a'}})).receiptUrl,'https://res.cloudinary.com/qa-test/image/upload/v1/a.png')
})
