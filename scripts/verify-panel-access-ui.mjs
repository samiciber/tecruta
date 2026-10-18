import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { createServer } from 'vite'
import { createSeparationRuntime } from '../server/prisma/tests/helpers/separation-runtime.mjs'
import { assignAdminUsername } from '../server/src/lib/adminUsername.js'
import { challenge } from '../server/src/lib/authSecurity.js'

const shop = 'http://127.0.0.1:5191', panel = 'http://127.0.0.1:5190'
process.env.CORS_ORIGINS = `${shop},${panel}`; process.env.STORE_ORIGIN = shop; process.env.PANEL_ORIGIN = panel
const rt = await createSeparationRuntime()
const require = createRequire(import.meta.url)
const { chromium } = require(join(process.env.TECRUTA_QA_TOOLS || join(tmpdir(), 'tecruta-home-final-tools/node_modules'), 'playwright-core'))
const evidence = join(rt.root, 'docs/acceso-panel/evidencia')
mkdirSync(evidence, { recursive: true })
const checks = [], errors = [], records = new Map(), mails = []
let browser, store, admin, api, identity = { sub: 'qa-ui-admin', email: rt.admin.email, email_verified: true }
const check = value => { checks.push(value); console.log(value) }
try {
  await assignAdminUsername(rt.db, rt.admin.email, 'ADMIN1234', { apply: true })
  api = await rt.start({ mailer: { verification: async () => {}, reset: async mail => { mails.push(mail) } }, google: {
    // Local provider double: real routes, state/cookie, both PKCE proofs and DB.
    authorizationUrl: (state, proof) => {
      const code = randomBytes(24).toString('hex'); records.set(code, { identity, proof })
      return `${api}/api/auth/google/callback?state=${state}&code=${code}`
    },
    exchange: async (code, verifier) => { assert.equal(records.get(code)?.proof, challenge(verifier)); return code },
    profile: async code => records.get(code).identity,
  } })
  const options = mode => ({ root: rt.root, configFile: join(rt.root, 'vite.config.js'), mode, envFile: false, cacheDir: join(rt.tempRoot, `vite-${mode}`), define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api), 'import.meta.env.VITE_STORE_ORIGIN': JSON.stringify(shop), 'import.meta.env.VITE_PANEL_ORIGIN': JSON.stringify(panel) }, server: { host: '127.0.0.1', port: mode === 'panel' ? 5190 : 5191, strictPort: true } })
  process.chdir(rt.root)
  store = await createServer(options('store')); await store.listen()
  admin = await createServer(options('panel')); await admin.listen()
  browser = await chromium.launch({ executablePath: process.env.TECRUTA_QA_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000)
  page.on('pageerror', error => errors.push(error.message))
  const capture = async name => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name)
    await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: true, animations: 'disabled' })
  }
  const clear = async origin => { await page.goto(origin + '/iniciar-sesion'); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }); await page.reload() }
  const login = async identifier => {
    await page.getByRole('textbox', { name: 'Usuario o correo', exact: true }).fill(identifier)
    await page.getByLabel('Contraseña', { exact: true }).fill(rt.password)
    await page.getByRole('button', { name: 'Ingresar al panel', exact: true }).click()
  }
  await page.goto(panel + '/iniciar-sesion')
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).waitFor()
  for (const [device, viewport] of [['escritorio', { width: 1440, height: 1000 }], ['tablet', { width: 834, height: 1112 }]]) {
    await page.setViewportSize(viewport)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
      await capture(`login-${device}-${theme}`)
    }
  }
  check('Login con usuario o correo y Google: escritorio/tablet, temas claro/oscuro sin desborde')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login('  AdMiN1234  ')
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  await page.reload()
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  await capture('alias-sesion-persistente')
  check('Alias normalizado inicia la misma sesión ADMIN y conserva acceso al recargar')
  await clear(panel)
  await page.goto(panel + '/productos')
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click()
  await page.waitForURL(panel + '/productos')
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  assert.equal(new URL(page.url()).search, '')
  await capture('google-panel-autorizado')
  check('Google vuelve al panel y conserva el destino protegido /productos, sin tokens en URL')
  // Session from panel must not log into store.
  await page.goto(shop + '/iniciar-sesion')
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click()
  await page.waitForURL(shop + '/')
  await capture('google-tienda-conservada')
  check('Google iniciado en tienda regresa a tienda; las sesiones por origen son independientes')
  await clear(panel)
  identity = { sub: 'qa-ui-customer', email: rt.customer.email, email_verified: true }
  await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'No se pudo autorizar' }).waitFor()
  await capture('google-cliente-rechazado')
  await login(rt.customer.email)
  await page.getByRole('alert').filter({ hasText: 'acceso no autorizado' }).waitFor()
  check('Cliente rechazado por Google y por contraseña en el panel')
  // Simulate a Google-only password; recovery must retain identity/role/alias.
  const { default: bcrypt } = await rt.load('server/node_modules/bcryptjs/index.js')
  await rt.db.user.update({ where: { id: rt.admin.id }, data: { passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10) } })
  await page.getByRole('link', { name: 'Recuperar contraseña', exact: true }).click()
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(rt.admin.email)
  await page.getByRole('button', { name: /Enviar código/ }).click()
  await page.getByRole('heading', { name: 'Restablece tu contraseña', exact: true }).waitFor()
  assert.ok(mails.length)
  await page.getByRole('textbox', { name: 'Código de verificación', exact: true }).fill(mails.at(-1).code)
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(rt.password)
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(rt.password)
  await page.getByRole('button', { name: 'Restablecer contraseña', exact: true }).click()
  await page.getByRole('heading', { name: 'Contraseña actualizada', exact: true }).waitFor()
  await capture('recuperacion-cuenta-google')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await login('ADMIN1234')
  await page.getByRole('navigation', { name: 'Secciones del panel' }).waitFor()
  const user = await rt.db.user.findUnique({ where: { id: rt.admin.id } })
  assert.equal(user.googleId, 'qa-ui-admin'); assert.equal(user.role, 'ADMIN'); assert.equal(user.adminUsername, 'admin1234')
  check('Recuperación por correo establece contraseña en cuenta Google y mantiene alias, identidad y rol')
  assert.deepEqual(errors, [])
  writeFileSync(join(evidence, 'resultados.json'), JSON.stringify({ syntheticOnly: true, disposablePostgres: true, providerDouble: true, checks, pageErrors: errors }, null, 2) + '\n')
} finally {
  if (browser) await browser.close()
  if (store) await store.close()
  if (admin) await admin.close()
  await rt.close()
}
