import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Herramienta local de revisión; nunca se importa en la aplicación desplegada.
// Sólo lee rutas públicas. No reenvía métodos de escritura, cookies ni tokens.
export async function createStoreStylePreview({ port = 5190 } = {}) {
 const origin = 'http://127.0.0.1:' + port
 const allowed = new Set(['/api/home','/api/products','/api/categories','/api/categories/tree','/api/nav','/api/footer','/api/site-settings','/api/brands','/api/popular-searches','/api/stores','/api/payment-methods'])
 const cache = new Map(), reads = [], blocked = []
 const isPublic = path => allowed.has(path) || /^\/api\/(products|categories|brands|legal)\/[^/]+$/.test(path)
 const read = async path => {
  if (!cache.has(path)) cache.set(path, (async () => { const response = await fetch('https://tecruta.onrender.com' + path, { signal: AbortSignal.timeout(45000), redirect: 'error' }); if (!response.ok) throw Error('No se pudo leer el contenido público: ' + response.status); const text = await response.text(); reads.push(path); return { status: response.status, text } })().catch(error => { cache.delete(path); throw error }))
  return cache.get(path)
 }
 await Promise.all(['/api/home','/api/products'].map(read))
 const plugin = { name: 'store-style-read-only', configureServer(server) { server.middlewares.use(async (req,res,next) => {
  const url = new URL(req.url,origin)
  if (!url.pathname.startsWith('/api/')) return next()
  res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store')
  if (req.method !== 'GET' || !isPublic(url.pathname)) { blocked.push({ method:req.method,path:url.pathname }); res.statusCode=405; return res.end(JSON.stringify({ error:'Vista local de diseño: compras y cambios deshabilitados.' })) }
  try { const result = await read(url.pathname + url.search); res.statusCode=result.status; res.end(result.text) } catch { res.statusCode=503; res.end(JSON.stringify({error:'No se pudo cargar la información pública para esta vista local.'})) }
 }) }, transformIndexHtml(html) { return html.replace('</body>','<div role="note" style="position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:300;padding:8px 16px;border-radius:99px;background:#17243d;color:white;font:12px system-ui;box-shadow:0 2px 12px #0003;max-width:95vw;text-align:center;pointer-events:none">Vista local de diseño · Compras deshabilitadas</div></body>') } }
 const server = await createServer({ mode:'store', envFile:false, plugins:[plugin], define:{ 'import.meta.env.VITE_API_URL':JSON.stringify(origin),'import.meta.env.VITE_STORE_ORIGIN':JSON.stringify(origin) },server:{host:'127.0.0.1',port,strictPort:true} })
 await server.listen()
 return {origin, reads,blocked, close:()=>server.close()}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const preview = await createStoreStylePreview();console.log('Vista local de diseño: '+preview.origin+' (datos públicos, sólo lectura)')
 for(const event of ['SIGINT','SIGTERM']) process.on(event,async()=>{await preview.close();process.exit(0)})
}
