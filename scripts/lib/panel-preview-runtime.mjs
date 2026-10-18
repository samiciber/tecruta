import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { randomBytes } from 'node:crypto'
import { createInventoryRuntime } from '../../server/prisma/tests/helpers/inventory-runtime.mjs'

// This module is a local review/test launcher; it is never imported by either
// application or by the production API. SMTP/Google/payment secrets are unused.
export async function createPanelPreview({ storePort = 5181, panelPort = 5180 } = {}) {
  const shop = `http://127.0.0.1:${storePort}`, panel = `http://127.0.0.1:${panelPort}`
  process.env.CORS_ORIGINS = `${shop},${panel}`
  process.env.STORE_ORIGIN = shop; process.env.PANEL_ORIGIN = panel
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  for (const key of ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[key]
  const outbox = []
  const rt = await createInventoryRuntime({ appOptions: async runtime => {
    const load = path => import(pathToFileURL(join(runtime.root, path)))
    const { createStaffRouter } = await load('server/src/routes/staff.routes.js')
    const { createAuthRouter } = await load('server/src/routes/auth.routes.js')
    const capture = async message => { outbox.push(message) }
    return { staff: createStaffRouter({ db: runtime.db, mailer: capture }), auth: createAuthRouter({ db: runtime.db, mailer: { reset: capture, verification: capture } }) }
  } })
  let store, admin
  try {
    const api = await rt.start()
    const bcrypt = (await rt.load('server/node_modules/bcryptjs/index.js')).default
    const password = 'Revision-local-2026!'
    await rt.db.user.updateMany({ data: { passwordHash: await bcrypt.hash(password, 10) } })
    for (const [account,username] of [[rt.admin,'adminlocal'],[rt.cashier,'cajerolocal'],[rt.warehouse,'almacenlocal']]) {
      await rt.db.user.update({where:{id:account.id},data:{adminUsername:username,ownerRecoveryEnabled:account.id===rt.admin.id}})
      account.username=username
    }
    await rt.db.paymentMethod.createMany({ data: ['cashOnDelivery', 'yape', 'plin', 'bankTransfer'].map(key => ({ key, label: key, active: true, config: {} })) })
    const products = []
    for (const [index, name, price] of [[1, 'Cable USB-C de prueba', '19.90'], [2, 'Cargador de prueba', '49.90'], [3, 'Audífonos de prueba', '79.00']]) {
      const product = await rt.product(20, { name, price, sku: `TR-DEMO-00${index}`, featured: true, image: `${shop}/revision-local/producto.svg` })
      if (index === 1) await rt.db.productBarcode.create({ data: { code: '0000123456789', normalizedCode: '0000123456789', kind: 'MANUFACTURER', productId: product.id } })
      products.push(product)
    }
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
    const review = {
      name: 'local-only-review',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url, panel).pathname
          if (path === '/revision-local/producto.svg') { res.setHeader('Content-Type', 'image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><rect width="500" height="500" fill="#e8efff"/><rect x="160" y="110" width="180" height="270" rx="25" fill="#2563eb"/><text x="250" y="440" font-size="28" text-anchor="middle" fill="#1e3a8a">PRODUCTO DE PRUEBA</text></svg>') }
          if (path !== '/revision-local') return next()
          res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store')
          res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisión local · TecRuta</title><style>body{font:17px system-ui;max-width:850px;margin:40px auto;padding:24px;background:#101827;color:#eef2ff}a{color:#93c5fd}td,th{padding:10px;text-align:left;border-bottom:1px solid #334155}table{width:100%}code{background:#24324a;padding:3px}p,li{line-height:1.7}</style><h1>TecRuta · Revisión local</h1><p>Datos sintéticos en PostgreSQL desechable. Nada de esta revisión pertenece al negocio ni se guarda en producción.</p><p><a href="${panel}/iniciar-sesion">Abrir panel</a> · <a href="${shop}">Abrir tienda</a></p><table><tr><th>Perfil de prueba</th><th>Usuario</th></tr>${[[rt.admin, 'Administrador'], [rt.cashier, 'Cajero / vendedor'], [rt.warehouse, 'Almacén']].map(([user, name]) => `<tr><td>${name}</td><td>${user.username}</td></tr>`).join('')}</table><p>Contraseña exclusiva de estas cuentas ficticias: <code>${password}</code>.</p><p>Usuarios y permisos: crea una cuenta sin correo, entrega su contraseña temporal y prueba su cambio obligatorio. No uses datos personales reales. El personal no recibe correos.</p><p>En el POS escanea <code>0000123456789</code> o busca “Cable”. Abre tu propio turno de caja antes de cobrar.</p><p>Las claves de autenticación doble de esta revisión se generan solo en memoria y desaparecen al cerrarla.</p><h2>Recuperación del titular: mensajes locales</h2><p>No se envían correos reales. Solo se intercepta aquí la recuperación del titular o de clientes sintéticos.</p>${outbox.length ? outbox.map(message => `<p>${escape(message.to)} · código local: <code>${escape(message.code)}</code></p>`).join('') : '<p>Sin mensajes todavía.</p>'}</html>`)
        })
      },
    }
    process.chdir(rt.root)
    const options = mode => ({ root: rt.root, configFile: join(rt.root, 'vite.config.js'), mode, cacheDir: join(rt.tempRoot, 'vite-' + mode), envFile: false, plugins: [review], define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api), 'import.meta.env.VITE_STORE_ORIGIN': JSON.stringify(shop), 'import.meta.env.VITE_PANEL_ORIGIN': JSON.stringify(panel) }, server: { host: '127.0.0.1', port: mode === 'panel' ? panelPort : storePort, strictPort: true } })
    store = await createServer(options('store')); await store.listen()
    admin = await createServer(options('panel')); await admin.listen()
    return { ...rt, api, shop, panel, password, products, outbox, close: async () => { await Promise.all([store.close(), admin.close()]); await rt.close() } }
  } catch (error) { await store?.close(); await admin?.close(); await rt.close(); throw error }
}
