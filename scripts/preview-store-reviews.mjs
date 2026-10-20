import {createServer} from 'vite'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {createInventoryRuntime} from '../server/prisma/tests/helpers/inventory-runtime.mjs'
import {seedFinalHome} from '../server/prisma/tests/helpers/final-home-fixtures.mjs'

export async function createStoreReviewsPreview({storePort=5201,panelPort=5202}={}){
 const shop=`http://127.0.0.1:${storePort}`,panel=`http://127.0.0.1:${panelPort}`
 process.env.CORS_ORIGINS=`${shop},${panel}`;process.env.STORE_ORIGIN=shop;process.env.PANEL_ORIGIN=panel;process.env.TRUST_PROXY='0'
 for(const key of ['RESEND_API_KEY','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','REVIEW_INVITATIONS_ENABLED'])delete process.env[key]
 const rt=await createInventoryRuntime({appOptions:async runtime=>{
   const load=p=>import(pathToFileURL(join(runtime.root,p)))
   const {createReviewsRouter,createReviewAdminRouter}=await load('server/src/routes/reviews.routes.js')
   const {createAuthRouter}=await load('server/src/routes/auth.routes.js')
   return {reviews:createReviewsRouter({db:runtime.db}),reviewAdmin:createReviewAdminRouter({db:runtime.db}),auth:createAuthRouter({db:runtime.db,mailer:{reset:async()=>{},verification:async()=>{}}})}
 }})
 let store,admin
 try{
   const api=await rt.start(),password=randomBytes(18).toString('base64url')
   const bcrypt=(await rt.load('server/node_modules/bcryptjs/index.js')).default
   await rt.db.user.updateMany({data:{passwordHash:await bcrypt.hash(password,10)}})
   await rt.db.user.update({where:{id:rt.admin.id},data:{adminUsername:'adminqa'}})
   const {createAdminProduct}=await rt.load('server/src/lib/adminProducts.js')
   const seedDb={...rt.db,product:{create:async({data})=>{
     const {categoryId,...fields}=data
     const category=await rt.db.category.findUnique({where:{id:categoryId}})
     return createAdminProduct(rt.db,{...fields,category:category.slug,stockReason:'Existencias sintéticas para revisión QA.'},rt.admin.id)
   }}}
   const fixture=await seedFinalHome(seedDb,shop)
   await rt.db.paymentMethod.create({data:{key:'qa-cash',label:'Efectivo (QA)',active:true,config:{}}})
   // No invented business details, phone, guarantees or delivery policies.
   await rt.db.siteSetting.upsert({where:{key:'storeBusiness'},create:{key:'storeBusiness',value:{}},update:{value:{}}})
   const order=async(user,product)=>rt.db.order.create({data:{userId:user.id,customerNombre:'QA',customerApellido:'Prueba',customerCorreo:user.email,customerCelular:'900000000',deliveryType:'PICKUP',departamento:'QA',provincia:'QA',distrito:'QA',subtotal:product.price,total:product.price,status:'DELIVERED',items:{create:{productId:product.id,name:product.name,quantity:1,unitPrice:product.price}}},include:{items:true}})
   const {createReview,moderateReview}=await rt.load('server/src/lib/reviewService.js')
   for(let i=0;i<4;i++){
     const user=await rt.db.user.create({data:{email:`qa-review-${i}@example.test`,nombre:'Cliente QA',apellido:`Prueba ${i}`,verified:true,passwordHash:'synthetic'}})
     const o=await order(user,fixture.products[0])
     const review=await createReview(rt.db,fixture.products[0].id,user.id,{orderItemId:o.items[0].id,rating:[5,1,4,3][i],title:'Escenario sintético QA',text:'Reseña sintética para verificar la interfaz local. No pertenece a un cliente real.'})
     if(i<3)await moderateReview(rt.db,review.id,rt.admin.id,{status:'APPROVED',...(i===0?{storeReply:'Respuesta sintética para revisar el diseño.'}:{})})
   }
   await order(rt.customer,fixture.products[0])
   const previewPlugin={name:'synthetic-review-fixtures',configureServer(server){server.middlewares.use((req,res,next)=>{
     const path=new URL(req.url,shop).pathname
     if(path.startsWith('/fixtures/')){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#0b2244"/><circle cx="940" cy="350" r="240" fill="#1e4b81"/><rect x="830" y="150" width="210" height="400" rx="20" fill="#eff4fb"/><path d="M900 300h80v90h-80z" fill="#46739e"/><text x="850" y="490" font-size="22" fill="#172538">PRODUCTO QA</text></svg>')}
     if(path!=='/revision-local')return next()
     res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store')
     res.end(`<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Revisión local QA</title><body style="font:18px system-ui;padding:32px"><h1>Revisión de tienda y reseñas — solo QA</h1><p>PostgreSQL local desechable. Productos y opiniones sintéticos, sin correos ni ventas reales.</p><p><a href="${shop}">Tienda</a> · <a href="${panel}/resenas">Moderación</a></p><p>Cliente QA: ${rt.customer.email}</p><p>Administrador QA: adminqa</p><p>Contraseña efímera de esta revisión: <code>${password}</code></p></body></html>`)
   })}}
   process.chdir(rt.root)
   const options=mode=>({root:rt.root,configFile:join(rt.root,'vite.config.js'),envFile:false,mode,cacheDir:join(rt.tempRoot,mode),plugins:[previewPlugin],define:{'import.meta.env.VITE_API_URL':JSON.stringify(api),'import.meta.env.VITE_STORE_ORIGIN':JSON.stringify(shop),'import.meta.env.VITE_PANEL_ORIGIN':JSON.stringify(panel)},server:{host:'127.0.0.1',port:mode==='panel'?panelPort:storePort,strictPort:true}})
   store=await createServer(options('store'));await store.listen();admin=await createServer(options('panel'));await admin.listen()
   return{...rt,shop,panel,password,products:fixture.products,close:async()=>{await Promise.all([store.close(),admin.close()]);await rt.close()}}
 }catch(e){await store?.close();await admin?.close();await rt.close();throw e}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const rt=await createStoreReviewsPreview()
 console.log(`Revisión QA local: ${rt.shop}/revision-local | panel ${rt.panel}/resenas`)
 let stopping=false
 for(const event of ['SIGINT','SIGTERM'])process.once(event,async()=>{if(stopping)return;stopping=true;await rt.close();process.exit()})
}
