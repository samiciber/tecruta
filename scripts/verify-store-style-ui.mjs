import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync,writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createStoreStylePreview } from './preview-store-style.mjs'
const require=createRequire(import.meta.url),{chromium}=require(join(tmpdir(),'tecruta-home-final-tools/node_modules/playwright-core'))
const rt=await createStoreStylePreview({port:5192}), evidence='docs/tienda-estilo/evidencia'
mkdirSync(evidence,{recursive:true})
const checks=[],errors=[],captures=[];let browser,page,failure=null
const check=t=>{checks.push(t);console.log(t)}
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Lima',reducedMotion:'reduce'})
 await context.route('**/*',route=>{const u=new URL(route.request().url());return (u.hostname==='127.0.0.1'||(route.request().method()==='GET'&&['image','font','stylesheet'].includes(route.request().resourceType())))?route.continue():route.abort()})
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message))
 const style=async enabled=>page.evaluate(enabled=>{const el=[...document.querySelectorAll('style[data-vite-dev-id]')].find(el=>el.getAttribute('data-vite-dev-id').endsWith('/src/storefront.css'));if(!el?.sheet)throw Error('No se encontró hoja de estilo');el.sheet.disabled=!enabled},enabled)
 const capture=async name=>{await page.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'})});await page.waitForTimeout(180);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' sin desbordamiento');await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,animations:'disabled'});captures.push(name+'.png');if((name.startsWith('inicio-')&&name.includes('-light-')&&!name.includes('tablet'))||name.startsWith('catalogo-')){await page.screenshot({path:join(evidence,name+'-vista.png'),fullPage:false,animations:'disabled'});captures.push(name+'-vista.png')}}
 await page.goto(rt.origin);await page.locator('.store-product-card').first().waitFor()
 await page.evaluate(async()=>{
  document.querySelectorAll('.storefront-section').forEach(el=>el.style.contentVisibility='visible')
  document.querySelectorAll('img').forEach(img=>img.loading='eager')
  await Promise.race([Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})}))),new Promise(resolve=>setTimeout(resolve,8000))])
  await document.fonts.ready
 })
 const hero=await page.locator('#home-hero h2').allTextContents(),names=await page.locator('.store-product-name').allTextContents(),prices=await page.locator('.store-product-price').allTextContents()
 const catalog=await(await fetch(rt.origin+'/api/products')).json();assert(catalog.length>0)
 for(const [device,width,height]of [['escritorio',1440,1000],['tablet',834,1112],['movil',390,844]]){
  await page.setViewportSize({width,height})
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme)
   for(const [label,enabled]of [['antes',false],['propuesta',true]]){await style(enabled);await capture('inicio-'+device+'-'+theme+'-'+label)}
   assert.deepEqual(await page.locator('#home-hero h2').allTextContents(),hero)
   assert.deepEqual(await page.locator('.store-product-name').allTextContents(),names)
   assert.deepEqual(await page.locator('.store-product-price').allTextContents(),prices)
  }
 }
 check('Comparación antes/después con los mismos productos, precios, banners y bloques; escritorio/tablet/móvil y ambos temas sin desbordamiento')
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.classList.remove('dark'))
 await page.getByRole('button',{name:'Menú',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Menú',exact:true}).getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape')
 const search=page.getByRole('combobox',{name:'Buscar en TecRuta',exact:true});await search.fill(catalog[0].name.split(' ')[0]);await search.press('Enter');await page.waitForURL('**/catalogo**')
 await page.locator('.store-product-card').first().waitFor();await page.evaluate(async()=>{document.querySelectorAll('img').forEach(img=>img.loading='eager');await Promise.race([Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})}))),new Promise(resolve=>setTimeout(resolve,10000))])});check('Menú y búsqueda mantienen la navegación existente')
 for(const [device,width,height]of [['escritorio',1440,1000],['movil',390,844]]){
  await page.setViewportSize({width,height});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);await capture('catalogo-'+device+'-'+theme)}
 }
 const card=page.locator('.store-product-card').first();const href=await card.locator('a').first().getAttribute('href')
 await card.locator('button[aria-pressed]').click();assert.equal(await card.locator('button[aria-pressed]').getAttribute('aria-pressed'),'true')
 await card.getByRole('button',{name:'Agregar al carrito',exact:true}).waitFor();await card.getByRole('button',{name:'Agregar al carrito',exact:true}).click()
 const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('tecruta:cart')));assert.equal(cart[0].quantity,1)
 await card.locator('a').first().click();await page.waitForURL('**'+href);check('Guardar producto, agregar al carrito de invitado y abrir detalle conservan sus acciones; sólo almacenamiento local')
 await page.getByRole('link',{name:/Carrito de compras/}).click();await page.waitForURL('**/carrito');await page.reload();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('tecruta:cart'))))[0].quantity,1)
 await capture('carrito-conservado');check('Carrito permanece al navegar y recargar')
 const blocked=await fetch(rt.origin+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,405);assert(!rt.reads.some(p=>p.includes('orders')))
 check('Vista local bloquea escrituras antes de cualquier envío al servidor; ninguna venta ni cuenta creada')
 assert.equal(errors.length,0,errors.join('\n'))
}catch(e){failure=e.message;if(page)await page.screenshot({path:join(evidence,'fallo.png'),fullPage:true}).catch(()=>{});throw e}
finally{writeFileSync(join(evidence,'resultados.json'),JSON.stringify({at:new Date().toISOString(),status:failure?'FAILED':'PASSED',failure,checks,errors,captures,reads:rt.reads,blocked:rt.blocked,productionWrites:0},null,2));await browser?.close();await rt.close()}
