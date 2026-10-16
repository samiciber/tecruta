import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { createFinalHomeRuntime } from '../server/prisma/tests/helpers/final-home-runtime.mjs'
import { seedFinalHome } from '../server/prisma/tests/helpers/final-home-fixtures.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(join(tmpdir(), 'tecruta-home-final-tools/node_modules/playwright-core'))
const runtime = await createFinalHomeRuntime()
const evidence = join(runtime.root, 'docs/lotes/evidencia-home-final')
mkdirSync(evidence, { recursive: true })
let vite, browser
const results = { checks: [], viewports: [], errors: [] }
try {
  const api = await runtime.start(4407)
  const fixture = await seedFinalHome(runtime.db, api)
  // Prisma was initialized in the env-free sandbox; Tailwind resolves its
  // installed project config from cwd. Vite still explicitly disables .env.
  process.chdir(runtime.root)
  vite = await createServer({ root: runtime.root, configFile: join(runtime.root, 'vite.config.js'), envFile: false, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, server: { host: '127.0.0.1', port: 5177, strictPort: true } })
  await vite.listen()
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, chromiumSandbox: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  page.on('pageerror', error => results.errors.push(error.message))
  const capture = async name => {
    await page.waitForTimeout(250)
    const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, scrollY, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }))
    assert.equal(metrics.scrollWidth, metrics.clientWidth, `Desbordamiento: ${name}`)
    results.viewports.push({ name, ...metrics })
    await page.screenshot({ path: join(evidence, `${name}.jpg`), type: 'jpeg', quality: 85, animations: 'disabled' })
    console.log(`Captura ${name}`)
  }
  const warm = async () => {
    for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 650) { await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(100) }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  }
  const captureSegments = async prefix => {
    await warm()
    const height = await page.evaluate(() => innerHeight)
    let index = 1
    for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += Math.floor(height * .8)) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y)
      await capture(`${prefix}-${String(index++).padStart(2, '0')}`)
      if (await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 1)) break
    }
  }
  const theme = async dark => { await page.evaluate(dark => { localStorage.setItem('tecruta:theme', JSON.stringify(dark ? 'dark' : 'light')) }, dark); await page.reload(); await page.waitForSelector('main h2'); await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, dark) }
  await page.goto('http://127.0.0.1:5177')
  await page.getByRole('heading', { name: 'Tecnología que te acompaña', exact: true }).waitFor()
  assert.equal(runtime.requests.some(r => r.path === '/api/products'), false)
  results.checks.push('Home inicial sin catálogo completo')
  for (const [width, height] of process.argv.includes('--admin-only') ? [] : [[1440, 1000], [390, 844], [768, 1000], [1024, 1000], [1280, 1000], [1920, 1000]]) {
    await page.setViewportSize({ width, height })
    for (const dark of [false, true]) {
      await theme(dark); await warm()
      const prefix = `home-${width}-${dark ? 'oscuro' : 'claro'}`
      await capture(`${prefix}-01`)
      if (width === 390 || width === 1440) {
        let index = 2
        const total = await page.evaluate(() => document.documentElement.scrollHeight)
        for (let y = Math.floor(height * .8); y < total - height + Math.floor(height * .8); y += Math.floor(height * .8)) { await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await capture(`${prefix}-${String(index++).padStart(2, '0')}`) }
      }
    }
  }
  if (!process.argv.includes('--admin-only')) results.checks.push('Matriz Home/footer 390, 768, 1024, 1280, 1440, 1920 en claro y oscuro sin overflow')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('tab', { name: 'En tu escritorio', exact: true }).press('ArrowRight')
  assert.equal(await page.getByRole('tab', { name: 'En movimiento', exact: true }).getAttribute('aria-selected'), 'true')
  await page.getByRole('tab', { name: 'En movimiento', exact: true }).press('Home')
  await page.getByRole('tab', { name: 'En tu escritorio', exact: true }).press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'tabpanel')
  results.checks.push('Pestañas y foco por teclado')
  const newsletter = page.locator('footer form')
  await newsletter.getByRole('textbox').fill('visual-qa@example.test')
  await newsletter.getByRole('checkbox').check()
  await newsletter.getByRole('button', { name: 'Suscribirme', exact: true }).click()
  await newsletter.getByRole('status').waitFor()
  assert.equal(await runtime.db.newsletterSubscriber.count(), 1)
  await newsletter.getByRole('textbox').fill('VISUAL-QA@example.test'); await newsletter.getByRole('checkbox').check(); await newsletter.getByRole('button', { name: 'Suscribirme', exact: true }).click()
  await newsletter.getByRole('alert').waitFor(); assert.match(await newsletter.getByRole('alert').innerText(), /ya está/)
  results.checks.push('Formulario guarda en PostgreSQL y muestra duplicado sin falso éxito')
  await page.route('**/api/newsletter/subscribe', route => route.abort())
  await newsletter.getByRole('textbox').fill('fallo@example.test'); await newsletter.getByRole('button', { name: 'Suscribirme', exact: true }).click()
  await newsletter.getByRole('alert').waitFor(); assert.equal(await newsletter.getByRole('status').count(), 0); assert.equal(await runtime.db.newsletterSubscriber.count(), 1)
  await page.unroute('**/api/newsletter/subscribe')
  results.checks.push('Fallo de red de suscripción: error y ningún falso éxito ni registro')
  await page.goto('http://127.0.0.1:5177/iniciar-sesion')
  await page.locator('main').getByLabel('Correo electrónico', { exact: true }).fill('qa-admin@example.test')
  await page.getByPlaceholder('Contraseña', { exact: true }).fill('qa-local-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.waitForURL('http://127.0.0.1:5177/')
  await page.goto('http://127.0.0.1:5177/admin/home-layout')
  await page.getByRole('heading', { name: 'Diseño del Home', exact: true }).waitFor()
  const splitSummary = page.locator('summary').filter({ hasText: 'Para tu próxima idea' })
  await splitSummary.click()
  const splitEditor = splitSummary.locator('..')
  await splitEditor.getByRole('textbox', { name: 'Buscar productos para la selección', exact: true }).fill('Auriculares')
  await splitEditor.getByLabel('Auriculares de prueba', { exact: true }).nth(1).waitFor()
  await splitEditor.getByLabel('Auriculares de prueba', { exact: true }).nth(1).check()
  await splitEditor.getByRole('button', { name: 'Subir producto', exact: true }).last().click()
  await splitSummary.click()
  const tileSummary = page.locator('summary').filter({ hasText: 'Una ruta para cada momento' })
  await tileSummary.click()
  await tileSummary.locator('..').getByRole('textbox', { name: 'Título de sección (opcional)', exact: true }).fill('Ruta editada y persistida')
  const beforePreview = await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })
  await page.getByRole('button', { name: 'Previsualizar borrador', exact: true }).click()
  await page.getByRole('heading', { name: 'Ruta editada y persistida', exact: true }).waitFor()
  assert.deepEqual((await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })).value, beforePreview.value)
  await page.getByRole('button', { name: 'Cerrar previsualización', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar diseño', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('main')?.textContent.includes('Hay cambios sin guardar.') === false)
  await page.reload(); await page.getByRole('heading', { name: 'Diseño del Home', exact: true }).waitFor()
  assert.equal((await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })).value.sections[4].title, 'Ruta editada y persistida')
  assert.deepEqual((await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })).value.sections[3].source.productIds, [0, 1, 2, 4, 3].map(i => fixture.products[i].id))
  results.checks.push('Selección manual: buscar, agregar y ordenar desde el formulario; orden persistido en PostgreSQL')
  results.checks.push('Compositor: preview real sin escritura; guardar y recargar con PostgreSQL')
  await page.getByRole('combobox', { name: 'Tipo de sección nueva', exact: true }).selectOption('legalText')
  await page.getByRole('button', { name: 'Agregar sección', exact: true }).click()
  const added = page.locator('summary').filter({ hasText: 'Texto legal' }).last()
  await added.click()
  await added.locator('..').getByRole('textbox', { name: 'Texto legal (texto plano)', exact: true }).fill('Texto de borrador local. '.repeat(100))
  await added.locator('..').getByLabel('Activa', { exact: true }).uncheck()
  await added.locator('..').getByRole('button', { name: 'Mover Texto legal arriba', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar diseño', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('main')?.textContent.includes('Hay cambios sin guardar.'))
  await page.reload(); await page.locator('summary').filter({ hasText: 'Texto legal' }).waitFor()
  const changedLayout = (await runtime.db.siteSetting.findUnique({ where: { key: 'homeLayout' } })).value
  assert.equal(changedLayout.sections[8].type, 'legalText'); assert.equal(changedLayout.sections[8].active, false); assert.equal(changedLayout.sections[8].text.length, 'Texto de borrador local. '.repeat(100).trim().length)
  results.checks.push('Compositor: agregar, editar texto largo, reordenar, desactivar, guardar y recargar')
  const legalSummary = page.locator('summary').filter({ hasText: 'Texto legal' }).last()
  await legalSummary.click()
  page.once('dialog', dialog => dialog.dismiss())
  await legalSummary.locator('..').getByRole('button', { name: 'Eliminar Texto legal', exact: true }).click()
  assert.equal(await page.locator('summary').filter({ hasText: 'Texto legal' }).count(), 1)
  page.once('dialog', dialog => dialog.accept())
  await legalSummary.locator('..').getByRole('button', { name: 'Eliminar Texto legal', exact: true }).click()
  assert.equal(await page.locator('summary').filter({ hasText: 'Texto legal' }).count(), 0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click()
  assert.equal(await page.locator('summary').filter({ hasText: 'Texto legal' }).count(), 1)
  results.checks.push('Confirmación al quitar contenido: cancelar conserva; aceptar elimina del borrador; descartar restaura lo guardado')
  for (const [width, height] of [[390, 844], [1440, 1000]]) {
    await page.setViewportSize({ width, height })
    for (const dark of [false, true]) { await theme(dark); await page.locator('summary').filter({ hasText: 'Ruta editada y persistida' }).click(); await captureSegments(`compositor-${width}-${dark ? 'oscuro' : 'claro'}`) }
  }
  await page.goto('http://127.0.0.1:5177/admin/footer')
  await page.getByRole('textbox', { name: 'Nombre del sitio en el footer', exact: true }).waitFor()
  await page.getByRole('textbox', { name: 'Descripción del sitio', exact: true }).fill('Descripción guardada en PostgreSQL local para QA.')
  await page.getByRole('button', { name: 'Guardar contenido', exact: true }).click()
  await page.getByText('Contenido guardado. Se conservará al recargar.', { exact: true }).waitFor()
  await page.reload(); await page.getByRole('textbox', { name: 'Descripción del sitio', exact: true }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Descripción del sitio', exact: true }).inputValue(), 'Descripción guardada en PostgreSQL local para QA.')
  for (const [width, height] of [[390, 844], [1440, 1000]]) { await page.setViewportSize({ width, height }); for (const dark of [false, true]) { await theme(dark); await captureSegments(`footer-admin-${width}-${dark ? 'oscuro' : 'claro'}`) } }
  results.checks.push('Footer admin: guardar/recargar real y matriz visual')
  await page.goto('http://127.0.0.1:5177/admin/suscriptores'); await page.getByText('visual-qa@example.test', { exact: true }).waitFor()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV', exact: true }).click()])
  await download.saveAs(join(evidence, 'newsletter-qa.csv'))
  await capture('newsletter-admin')
  results.checks.push('Lista ADMIN y exportación CSV desde navegador')
  assert.deepEqual(results.errors, [])
  writeFileSync(join(evidence, process.argv.includes('--admin-only') ? 'resultados-admin.json' : 'resultados.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ checks: results.checks, screenshots: results.viewports.length, errors: results.errors }, null, 2))
} catch (error) {
  const failedPage = browser?.contexts()[0]?.pages()[0]
  if (failedPage) { await failedPage.screenshot({ path: join(evidence, 'fallo-qa.jpg') }); results.pageText = await failedPage.locator('body').innerText(); writeFileSync(join(evidence, 'fallo-qa.html'), await failedPage.content()) }
  results.failure = error.stack
  writeFileSync(join(evidence, 'resultados.json'), JSON.stringify(results, null, 2))
  throw error
} finally { if (browser) await browser.close(); if (vite) await vite.close(); await runtime.close() }
