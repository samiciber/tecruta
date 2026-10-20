import {before,after,test} from 'node:test'
import assert from 'node:assert/strict'
import {createInventoryRuntime} from './helpers/inventory-runtime.mjs'
import {runPrisma,runDocker,createPrismaWorkspace} from './helpers/isolated-runtime.mjs'
import {join} from 'node:path'
import * as fs from 'node:fs'
let rt,base,p,line,review,other,otherLine,limits,db
async function request(path,{user=rt?.customer,body,method=body?'POST':'GET'}={}) {
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${rt.auth(user)}`}:{})},body:body?JSON.stringify(body):undefined})
 return {status:response.status,data:await response.json()}
}
const list=(query='')=>request(`/api/reviews/products/${p.id}${query}`,{user:null})
const create=(extra={},user=rt.customer)=>request(`/api/reviews/products/${p.id}`,{user,body:{orderItemId:line?.id || 'no-purchase',rating:4,title:'Experiencia de uso',text:'Texto sintético para probar la reseña.',...extra}})
const moderate=(body,user=rt.admin)=>request('/api/admin/reviews/'+review.id,{user,method:'PATCH',body})
async function order(user,status='DELIVERED') {
 const row=await db.order.create({data:{userId:user.id,customerNombre:'QA',customerApellido:'Pruebas',customerCorreo:'qa@example.test',customerCelular:'900000000',deliveryType:'PICKUP',departamento:'QA',provincia:'QA',distrito:'QA',subtotal:10,total:10,status,items:{create:{productId:p.id,name:p.name,quantity:1,unitPrice:10}},statusHistory:{create:{status,createdAt:new Date(Date.now()-10*86400000)}}},include:{items:true}})
 return row.items[0]
}
before(async()=>{
 rt=await createInventoryRuntime({appOptions:async runtime=>{
   const routes=await import(new URL('../../src/routes/reviews.routes.js',import.meta.url));limits=routes.reviewWriteLimiter
   return {reviews:routes.createReviewsRouter({db:runtime.db}),reviewAdmin:routes.createReviewAdminRouter({db:runtime.db})}
 }})
 db=rt.db;p=await rt.product(10);base=await rt.start()
 other=await db.user.create({data:{email:'qa-review-other@example.test',nombre:'Otra',apellido:'Persona',role:'CUSTOMER',verified:true,passwordHash:'not-a-real-password'}})
})
after(async()=>{await rt?.close()})
test('sin compra entregada, invitado, personal y otro dueño no pueden reseñar',async()=>{
 assert.equal((await create()).status,403)
 line=await order(rt.customer,'PAID');assert.equal((await create()).status,403)
 assert.equal((await create({},null)).status,401)
 for(const user of [rt.admin,rt.warehouse,rt.cashier])assert.equal((await create({},user)).status,403)
 await db.order.update({where:{id:line.orderId},data:{status:'DELIVERED'}})
 assert.equal((await create({},other)).status,403)
})
test('validación de calificación, títulos y contenido sin HTML o enlaces',async()=>{
 for(const rating of [0,6,1.5])assert.equal((await create({rating})).status,400)
 for(const text of ['corto','<b>Opinión del producto</b>','Consulta https://example.test','Visita www.example.test','Visita example.com ahora'])assert.equal((await create({text})).status,400)
 assert.equal((await create({title:'a'.repeat(81)})).status,400)
 limits.resetKey('127.0.0.1')
})
test('una reseña por compra y por usuario/producto incluso con envíos simultáneos',async()=>{
 const results=await Promise.all([create(),create()]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409])
 review=results.find(r=>r.status===201).data;assert.equal(review.status,'PENDING')
 const nextLine=await order(rt.customer);assert.equal((await create({orderItemId:nextLine.id})).status,409)
 assert.equal((await list()).data.items.length,0)
 assert.equal((await request(`/api/reviews/products/${p.id}/eligibility`)).data.reason,'ALREADY_REVIEWED')
 assert.equal((await db.product.findUnique({where:{id:p.id}})).ratingCount,0)
})
test('solo ADMIN modera; aprobar concurrentemente cuenta una sola vez y audita',async()=>{
 for(const user of [rt.customer,rt.cashier,rt.warehouse]){
  assert.equal((await request('/api/admin/reviews',{user})).status,403)
  assert.equal((await moderate({status:'APPROVED'},user)).status,403)
 }
 const rows=await Promise.all([moderate({status:'APPROVED'}),moderate({status:'APPROVED'})]);assert.ok(rows.every(r=>r.status===200))
 const data=(await list()).data;assert.equal(data.summary.count,1);assert.equal(data.summary.average,4);assert.equal(data.summary.distribution.find(r=>r.rating===4).count,1)
 assert.equal(data.items[0].verifiedPurchase,true);assert.ok(!JSON.stringify(data).includes(rt.customer.email));assert.ok(!JSON.stringify(data).includes(line.id));assert.equal(data.items[0].name,rt.customer.nombre+' '+rt.customer.apellido[0]+'.')
 assert.equal(await db.staffAuditEvent.count({where:{action:'REVIEW_MODERATED'}}),2)
})
test('rechazar, re-rechazar y volver a aprobar mantienen cantidad y suma',async()=>{
 assert.equal((await moderate({status:'REJECTED'})).status,400)
 for(let i=0;i<2;i++)assert.equal((await moderate({status:'REJECTED',rejectionReason:'No cumple el criterio de publicación.'})).status,200)
 assert.equal((await list()).data.summary.count,0);assert.equal((await list()).data.summary.sum,0)
 assert.equal((await moderate({status:'APPROVED',storeReply:'Gracias por compartir tu experiencia.'})).status,200)
 const row=(await list()).data;assert.equal(row.summary.sum,4);assert.equal(row.items[0].storeReply,'Gracias por compartir tu experiencia.')
 assert.equal((await moderate({storeReply:'<p>No permitido</p>'})).status,400)
})
test('voto útil concurrente idempotente, autor rechazado y reseñas ocultas protegidas',async()=>{
 limits.resetKey('127.0.0.1')
 assert.equal((await request(`/api/reviews/${review.id}/helpful`,{body:{}})).status,403)
 const results=await Promise.all([request(`/api/reviews/${review.id}/helpful`,{user:other,body:{}}),request(`/api/reviews/${review.id}/helpful`,{user:other,body:{}})])
 assert.ok(results.every(r=>r.status===200));assert.equal((await list()).data.items[0].helpfulCount,1)
 await moderate({status:'REJECTED',rejectionReason:'Retirada para nueva revisión.'})
 assert.equal((await request(`/api/reviews/${review.id}/helpful`,{user:other,body:{}})).status,404)
 await moderate({status:'APPROVED'})
})
test('cursores, filtros, privacidad y portada solo con tres aprobadas de cualquier nota',async()=>{
 limits.resetKey('127.0.0.1')
 otherLine=await order(other)
 const second=await create({orderItemId:otherLine.id,rating:1},other);assert.equal(second.status,201)
 await request('/api/admin/reviews/'+second.data.id,{user:rt.admin,method:'PATCH',body:{status:'APPROVED'}})
 assert.equal((await request('/api/reviews/recent')).data.items.length,0)
 const third=await db.user.create({data:{email:'qa-third@example.test',nombre:'QA',apellido:'Tercero',role:'CUSTOMER',verified:true,passwordHash:'synthetic'}})
 const thirdLine=await order(third);const r=await create({orderItemId:thirdLine.id,rating:5},third)
 await request('/api/admin/reviews/'+r.data.id,{user:rt.admin,method:'PATCH',body:{status:'APPROVED'}})
 const recent=(await request('/api/reviews/recent')).data.items;assert.equal(recent.length,3);assert.ok(recent.some(r=>r.rating===1))
 const first=(await list('?limit=1')).data;assert.ok(first.nextCursor)
 const secondPage=(await list('?limit=1&cursor='+first.nextCursor)).data;assert.notEqual(first.items[0].id,secondPage.items[0].id)
 assert.equal((await list('?rating=1')).data.items.length,1)
 assert.equal((await list('?sort=helpful&cursor='+first.nextCursor)).status,400)
 assert.equal((await list('?cursor=invalid')).status,400)
 assert.equal((await list('?sort=helpful')).data.items[0].helpfulCount,1)
 assert.equal((await list()).data.summary.sum,10);assert.equal((await list()).data.summary.count,3)
})
test('límite de intentos devuelve 429',async()=>{
 limits.resetKey('127.0.0.1');let last
 for(let i=0;i<21;i++)last=await create({text:'corto'})
 assert.equal(last.status,429);limits.resetKey('127.0.0.1')
})
test('restricciones SQL y migración sincronizadas con Prisma',async()=>{
 await assert.rejects(db.$executeRaw`UPDATE product_reviews SET rating=6 WHERE id=${review.id}`)
 await assert.rejects(db.$executeRaw`UPDATE products SET "ratingSum"=999 WHERE id=${p.id}`)
 await assert.rejects(db.$executeRaw`UPDATE product_reviews SET status='REJECTED', "rejectionReason"=NULL WHERE id=${review.id}`)
 const schema=join(rt.tempRoot,'schema/schema.prisma')
 let output
 try {output=runPrisma({root:rt.root,tempRoot:rt.tempRoot,schemaPath:schema,dotenvPath:join(rt.tempRoot,'qa-empty-dotenv'),databaseUrl:process.env.DATABASE_URL,args:['migrate','diff','--from-url',process.env.DATABASE_URL,'--to-schema-datamodel',schema,'--exit-code']})} catch(e) {console.log(String(e.stdout));throw e}
 assert.match(output,/No difference detected/)
})
test('invitaciones desactivadas no conectan ni envían; activadas idempotentes y ventana segura',async()=>{
 const {runReviewInvitations}=await import('../../src/lib/reviewInvitations.js');let sent=0
 assert.deepEqual(await runReviewInvitations({db:null,env:{},send:()=>{throw Error('No debe enviar')}}),{enabled:false,sent:0})
 const buyer=await db.user.create({data:{email:'qa-invite@example.test',nombre:'QA',apellido:'Invitación',role:'CUSTOMER',verified:true,passwordHash:'synthetic'}})
 await order(buyer)
 const env={REVIEW_INVITATIONS_ENABLED:'true',REVIEW_INVITATION_DAYS:'7',STORE_ORIGIN:'https://store.example.test'}
 const send=async message=>{sent++;assert.match(message.idempotencyKey,/^review-invitation\//);assert.ok(message.productUrl.endsWith('#resenas'));return{id:'qa-provider-result'}}
 await Promise.all([runReviewInvitations({db,env,send}),runReviewInvitations({db,env,send})]);assert.equal(sent,1)
 await runReviewInvitations({db,env,send});assert.equal(sent,1)
})

test('invitaciones omiten compras repetidas ya reseñadas antes de limitar el lote',async()=>{
 const {runReviewInvitations}=await import('../../src/lib/reviewInvitations.js')
 // More than one whole batch of repeat purchases must not starve new buyers.
 for(let i=0;i<101;i++)await order(rt.customer)
 const buyer=await db.user.create({data:{email:'qa-invite-later@example.test',nombre:'QA',apellido:'Lote',verified:true,passwordHash:'synthetic'}})
 const item=await order(buyer);let sent=0
 const env={REVIEW_INVITATIONS_ENABLED:'true',REVIEW_INVITATION_DAYS:'7',STORE_ORIGIN:'https://store.example.test'}
 await runReviewInvitations({db,env,send:async()=>{sent++;return{id:'qa-later'}}})
 assert.equal(sent,1);assert.ok((await db.reviewInvitation.findUnique({where:{orderItemId:item.id}})).sentAt)
})

test('envío incierto conserva clave, no marca éxito sin confirmación y no reintenta tras 23 horas',async()=>{
 const {runReviewInvitations}=await import('../../src/lib/reviewInvitations.js')
 const buyer=await db.user.create({data:{email:'qa-invite-uncertain@example.test',nombre:'QA',apellido:'Incierto',verified:true,passwordHash:'synthetic'}})
 const item=await order(buyer),now=new Date(),keys=[]
 const env={REVIEW_INVITATIONS_ENABLED:'true',STORE_ORIGIN:'https://store.example.test'}
 await assert.rejects(runReviewInvitations({db,env,now,send:async message=>{keys.push(message.idempotencyKey);throw Error('Synthetic connection loss')}}))
 const claim=await db.reviewInvitation.findUnique({where:{orderItemId:item.id}});assert.equal(claim.sentAt,null)
 await assert.rejects(runReviewInvitations({db,env,now,send:async message=>{keys.push(message.idempotencyKey);return{}}}))
 assert.equal(keys[0],keys[1]);assert.equal((await db.reviewInvitation.findUnique({where:{id:claim.id}})).sentAt,null)
 const result=await runReviewInvitations({db,env,now:new Date(now.getTime()+24*3600000),send:async()=>{throw Error('No debe reenviar')}})
 assert.equal(result.sent,0)
})

test('upgrade aditivo desde main conserva productos, pedidos y cuentas anteriores',()=>{
 const name='qa_reviews_upgrade'
 runDocker(['exec',rt.container,'psql','-X','-v','ON_ERROR_STOP=1','-U','qa_final_home','-d','qa_final_home','-c','CREATE DATABASE '+name])
 const url=new URL(process.env.DATABASE_URL);url.pathname='/'+name
 const workspace=createPrismaWorkspace({tempRoot:rt.tempRoot,name:'reviews-upgrade',schemaSource:join(rt.root,'server/prisma/schema.prisma'),migrationsSource:join(rt.root,'server/prisma/migrations'),excludedMigrations:['20261020000000_product_reviews']})
 const migrate=()=>runPrisma({root:rt.root,tempRoot:rt.tempRoot,schemaPath:workspace.schemaPath,dotenvPath:process.env.DOTENV_CONFIG_PATH,databaseUrl:url.href,args:['migrate','deploy','--schema',workspace.schemaPath]})
 migrate()
 const sql=input=>runDocker(['exec','-i',rt.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','qa_final_home','-d',name],{input}).trim()
 sql(`INSERT INTO users(id,email,"passwordHash",nombre,apellido,role,verified,"updatedAt") VALUES ('qa-preserve','qa-preserve@example.test','synthetic-hash','QA','Conservar','CUSTOMER',true,'2026-01-01');
 INSERT INTO categories(id,slug,name) VALUES ('qa-category-preserve','qa-preserve','QA');
 INSERT INTO products(id,slug,sku,name,price,stock,tags,"categoryId","updatedAt") VALUES ('qa-product-preserve','qa-preserve','QA-PRESERVE','QA conservar',17.90,0,'{}','qa-category-preserve','2026-01-01');
 INSERT INTO orders(id,"userId","customerNombre","customerApellido","customerCorreo","customerCelular","deliveryType",departamento,provincia,distrito,subtotal,total,status,"updatedAt") VALUES ('qa-order-preserve','qa-preserve','QA','Conservar','qa-preserve@example.test','900000000','PICKUP','QA','QA','QA',17.90,17.90,'DELIVERED','2026-01-01');
 INSERT INTO order_items(id,"orderId","productId",name,quantity,"unitPrice") VALUES ('qa-line-preserve','qa-order-preserve','qa-product-preserve','QA conservar',1,17.90);`)
 const snapshot=`SELECT jsonb_build_object('users',(SELECT jsonb_agg(to_jsonb(u)) FROM users u),'products',(SELECT jsonb_agg(to_jsonb(p)-'ratingCount'-'ratingSum') FROM products p),'orders',(SELECT jsonb_agg(to_jsonb(o)) FROM orders o),'items',(SELECT jsonb_agg(to_jsonb(i)) FROM order_items i),'inventory',(SELECT count(*) FROM inventory_movements));`
 const before=JSON.parse(sql(snapshot))
 // Copy only the new migration after the old schema has been applied.
 const {readFileSync,mkdirSync,writeFileSync}=fs
 const path=join(workspace.migrationsPath,'20261020000000_product_reviews');mkdirSync(path)
 writeFileSync(join(path,'migration.sql'),readFileSync(join(rt.root,'server/prisma/migrations/20261020000000_product_reviews/migration.sql')))
 migrate();assert.deepEqual(JSON.parse(sql(snapshot)),before)
 assert.equal(sql('SELECT count(*) FROM product_reviews'),'0')
 assert.equal(sql('SELECT count(*) FROM products WHERE "ratingCount"=0 AND "ratingSum"=0'),'1')
})
