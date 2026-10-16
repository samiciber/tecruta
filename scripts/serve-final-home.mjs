// Only a disposable PostgreSQL database and a new browser context are used.
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { createServer } from 'vite'
import { createInterface } from 'node:readline/promises'
import { createFinalHomeRuntime } from '../server/prisma/tests/helpers/final-home-runtime.mjs'
import { seedFinalHome } from '../server/prisma/tests/helpers/final-home-fixtures.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(join(tmpdir(), 'tecruta-home-final-tools/node_modules/playwright-core'))
// Do not inherit credentials, NODE_OPTIONS, DATABASE_URL or VITE_* settings.
const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|SYSTEMDRIVE|OS|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/i
for (const key of Object.keys(process.env)) if (!allowed.test(key)) delete process.env[key]
process.env.NODE_ENV = 'test'
process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL = '1'
const availablePort = preferred => new Promise((resolve, reject) => {
  const server = createNetServer()
  server.once('error', error => error.code === 'EADDRINUSE' ? availablePort(0).then(resolve, reject) : reject(error))
  server.listen(preferred, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)) })
})
const port = await availablePort(5177)
const origin = `http://127.0.0.1:${port}`
process.env.CORS_ORIGIN = origin
const runtime = await createFinalHomeRuntime({ realInteractiveApi: true })
let browser, vite, input
try {
  const api = await runtime.start(0)
  await seedFinalHome(runtime.db, api)
  const { footerDefaults, footerSchema } = await import('../server/src/lib/footerContent.js')
  await runtime.db.siteSetting.create({ data: { key: 'footerContent', value: footerSchema.parse({ ...footerDefaults,
    brand: 'TecRuta QA local', description: 'Entorno de prueba: productos, precios, imágenes y cuentas sintéticos.',
    contactTitle: 'Contacto QA', contactLines: ['Información de prueba, sin validez comercial.'], email: 'contacto@example.test', whatsapp: '', socials: [],
    copyright: 'QA local: contenido sintético, sin publicación.',
    newsletter: { ...footerDefaults.newsletter, title: 'Suscripción de prueba QA', description: 'Usa solo correos ficticios @example.test. No se envían correos.' },
  }) } })
  process.chdir(runtime.root)
  vite = await createServer({ root: runtime.root, configFile: join(runtime.root, 'vite.config.js'), envFile: false, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, server: { host: '127.0.0.1', port, strictPort: true } }); await vite.listen()
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: false, chromiumSandbox: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima', serviceWorkers: 'block' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  page.setDefaultTimeout(90000)
  page.setDefaultNavigationTimeout(90000)
  const goto = url => page.goto(url, { waitUntil: 'domcontentloaded' })
  console.log(`Servicios QA: tienda ${origin}; API ${api}; PostgreSQL ${runtime.container}`)
  await goto(origin)
  const checks = [], errors = []
  const push = checks.push.bind(checks)
  checks.push = check => { console.log(`Comprobado: ${check}`); return push(check) }
  page.on('pageerror', error => errors.push(error.message))
  await page.getByRole('heading', { name: 'Tecnología que te acompaña', exact: true }).waitFor()
  checks.push('Home')
  await goto(`${origin}/catalogo`)
  await page.getByText('Auriculares de prueba', { exact: true }).first().waitFor()
  checks.push('Catálogo')
  await goto(`${origin}/iniciar-sesion`)
  await page.locator('main').getByLabel('Correo electrónico', { exact: true }).fill('qa-admin@example.test')
  await page.getByPlaceholder('Contraseña', { exact: true }).fill('qa-local-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.waitForURL(`${origin}/`)
  checks.push('Login UI real con contraseña QA')
  const login = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: runtime.admin.email, password: 'qa-local-only' }) })
  assert.equal(login.status, 200)
  const { token } = await login.json()
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const product = await runtime.db.product.findFirst({ where: { stock: { gt: 0 } } })
  for (const path of ['cart', 'saved']) {
    const response = await fetch(`${api}/api/${path}/items`, { method: 'POST', headers, body: JSON.stringify({ productId: product.id, quantity: 1 }) })
    assert.ok(response.ok, `${path}: ${response.status}`)
  }
  assert.equal(await runtime.db.cartItem.count(), 1)
  assert.equal(await runtime.db.savedItem.count(), 1)
  await goto(`${origin}/carrito`)
  await page.getByRole('heading', { name: 'Tu carrito (1)', exact: true }).waitFor()
  await goto(`${origin}/elementos-guardados`)
  await page.locator('main').getByText(product.name, { exact: true }).first().waitFor()
  checks.push('Carrito y guardados: rutas reales, PostgreSQL y UI')
  await goto(`${origin}/admin/home-layout`)
  await page.getByRole('heading', { name: 'Diseño del Home', exact: true }).waitFor()
  const before = await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })
  await page.getByRole('button', { name: 'Previsualizar borrador', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar previsualización', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Tecnología que te acompaña', exact: true }).waitFor()
  assert.deepEqual((await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })).value, before.value)
  await page.getByRole('button', { name: 'Cerrar previsualización', exact: true }).click()
  checks.push('Diseño Home y preview sin escritura')
  await goto(`${origin}/admin/footer`)
  await page.getByRole('heading', { name: 'Footer y contenido legal', exact: true }).waitFor()
  checks.push('Administración footer')
  const subscription = await fetch(`${api}/api/newsletter/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'revision-qa@example.test', consent: true }) })
  assert.equal(subscription.status, 201)
  await goto(`${origin}/admin/suscriptores`)
  await page.getByText('revision-qa@example.test', { exact: true }).waitFor()
  checks.push('Suscriptores: alta QA y lista real')
  assert.deepEqual(errors, [])
  await goto(origin)
  const report = { origin, api, container: runtime.container, tempRoot: runtime.tempRoot, pid: process.pid, checks, errors, synthetic: true }
  writeFileSync(join(tmpdir(), 'tecruta-local-review.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`QA local aislado: ${origin}. Admin QA: qa-admin@example.test; contraseña QA: qa-local-only. Autenticación del proyecto con cuentas sintéticas; sin publicación.`)
  input = createInterface({ input: process.stdin, output: process.stdout })
  process.once('SIGINT', () => input.close())
  await input.question('Pulsa Enter para cerrar el navegador y eliminar exclusivamente esta base de prueba. ')
} finally { input?.close(); if (browser) await browser.close(); if (vite) await vite.close(); await runtime.close() }
