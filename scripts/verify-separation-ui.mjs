import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'
import { createSeparationRuntime } from '../server/prisma/tests/helpers/separation-runtime.mjs'

const shop = 'http://127.0.0.1:5191', panel = 'http://127.0.0.1:5190'
process.env.CORS_ORIGINS = `${shop},${panel}`
process.env.STORE_ORIGIN = shop
process.env.PANEL_ORIGIN = panel
const rt = await createSeparationRuntime()
const require = createRequire(import.meta.url)
const { chromium } = require(join(process.env.TECRUTA_QA_TOOLS || join(tmpdir(), 'tecruta-home-final-tools/node_modules'), 'playwright-core'))
const evidence = process.env.TECRUTA_QA_EVIDENCE || join(rt.root, 'docs/separacion/evidencia')
mkdirSync(evidence, { recursive: true })
const checks = [], errors = []
let browser, store, admin
const check = message => { checks.push(message); console.log(message) }
try {
  const api = await rt.start()
  const category = await rt.db.category.create({ data: { slug: 'qa-cables', name: 'Cables QA' } })
  await rt.db.product.create({ data: { name: 'Cable sintético QA', slug: 'qa-cable', categoryId: category.id, price: '19.90', stock: 20, featured: true } })
  const options = mode => ({ root: rt.root, configFile: join(rt.root, 'vite.config.js'), mode, envFile: false, cacheDir: join(rt.tempRoot, `vite-${mode}`), define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api), 'import.meta.env.VITE_STORE_ORIGIN': JSON.stringify(shop), 'import.meta.env.VITE_PANEL_ORIGIN': JSON.stringify(panel) }, server: { host: '127.0.0.1', port: mode === 'panel' ? 5190 : 5191, strictPort: true } })
  process.chdir(rt.root)
  store = await createServer(options('store')); await store.listen()
  admin = await createServer(options('panel')); await admin.listen()
  browser = await chromium.launch({ executablePath: process.env.TECRUTA_QA_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  const capture = async name => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name)
    await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: true, animations: 'disabled' })
  }
  const login = async email => {
    await page.goto(panel + '/iniciar-sesion')
    await page.getByRole('textbox', { name: 'Usuario o correo', exact: true }).fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(rt.password)
    await page.getByRole('button', { name: 'Ingresar al panel', exact: true }).click()
  }
  await page.goto(panel + '/productos')
  await page.waitForURL('**/iniciar-sesion?volver=*')
  await page.getByRole('heading', { name: 'Panel TecRuta' }).waitFor()
  await capture('login')
  await login(rt.customer.email)
  await page.getByRole('alert').filter({ hasText: 'acceso no autorizado' }).waitFor()
  await login(rt.admin.email)
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  assert.equal(await page.getByRole('link', { name: /Inventario|Punto de venta|Usuarios y permisos/ }).count(), 0)
  check('Login existente: ADMIN autorizado y cliente rechazado; funciones excluidas ausentes')
  await page.goto(panel + '/ajustes')
  await page.getByLabel('Texto', { exact: true }).fill('Revisión sintética de separación')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('form button[type=submit]')?.disabled)
  await page.reload()
  assert.equal(await page.getByLabel('Texto', { exact: true }).inputValue(), 'Revisión sintética de separación')
  await page.goto(panel + '/home-layout')
  await page.getByRole('button', { name: 'Previsualizar borrador' }).click()
  await page.getByRole('heading', { name: 'Previsualización del borrador (sin guardar)' }).waitFor()
  assert.equal(await page.locator('[inert]').count(), 1)
  await page.goto(panel + '/admin/productos?revision=1')
  await page.waitForURL(panel + '/productos?revision=1')
  await page.reload()
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  check('Ajustes persisten, Home conserva su vista previa y rutas antiguas/recarga funcionan')
  await page.goto(panel)
  await page.getByRole('heading', { name: 'Resumen' }).waitFor()
  for (const [device, viewport] of [['escritorio', { width: 1440, height: 1000 }], ['tablet', { width: 834, height: 1112 }]]) {
    await page.setViewportSize(viewport)
    for (const theme of ['claro', 'oscuro']) {
      if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'oscuro')) await page.getByRole('button', { name: /Cambiar a modo/ }).click()
      await capture(`${device}-${theme}`)
    }
  }
  check('Escritorio y tablet: navegación y ambos temas sin desbordamiento')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(shop + '/iniciar-sesion')
  await page.getByRole('heading', { name: 'Inicia sesión', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => sessionStorage.getItem('tecruta:token')), null)
  await page.goto(shop + '/catalogo')
  const card = page.locator('div.group.relative.flex.flex-col').filter({ has: page.getByRole('link', { name: 'Cable sintético QA', exact: true }) }).first()
  await card.getByRole('button', { name: 'Agregar al carrito', exact: true }).click()
  await page.goto(shop + '/carrito')
  await page.getByRole('link', { name: 'Ir a pagar' }).waitFor()
  await page.reload()
  await page.getByRole('link', { name: 'Ir a pagar' }).click()
  await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor()
  await capture('checkout')
  await page.goto(shop)
  await page.getByRole('banner').first().waitFor()
  await capture('tienda')
  await page.goto(shop + '/admin/productos?revision=1')
  await page.waitForURL(panel + '/productos?revision=1')
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  assert.equal(new URL(page.url()).searchParams.has('token'), false)
  check('Tienda: catálogo, carrito persistente, checkout, sesión independiente y redirección al panel')
  // A temporary API/network failure must preserve the saved session for retry.
  await context.route(api + '/api/auth/me', route => route.abort())
  await page.reload()
  await page.getByRole('button', { name: /Reintentar/ }).waitFor()
  assert.ok(await page.evaluate(() => sessionStorage.getItem('tecruta:token')))
  await context.unroute(api + '/api/auth/me')
  await page.getByRole('button', { name: /Reintentar/ }).click()
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  check('Pérdida temporal de conexión: sesión conservada y recuperación con Reintentar')
  assert.deepEqual(errors, [])
  writeFileSync(join(evidence, 'resultados.json'), JSON.stringify({ checks, errors, database: 'PostgreSQL local desechable; esquema de separación sin inventario/POS, datos sintéticos' }, null, 2) + '\n')
} finally { await browser?.close(); await store?.close(); await admin?.close(); await rt.close() }
