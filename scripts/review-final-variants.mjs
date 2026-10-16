import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createFinalHomeRuntime } from '../server/prisma/tests/helpers/final-home-runtime.mjs'
import { seedFinalHome } from '../server/prisma/tests/helpers/final-home-fixtures.mjs'
import { bannerSchema } from '../server/src/lib/navSchemas.js'
const require = createRequire(import.meta.url)
const { chromium } = require(join(tmpdir(), 'tecruta-home-final-tools/node_modules/playwright-core'))
const runtime = await createFinalHomeRuntime()
let vite, browser
const results = { checks: [], viewports: [], errors: [] }
const longMode = process.argv.includes('--long-only')
const evidence = join(runtime.root, 'docs/lotes/evidencia-home-final')
try {
  const api = await runtime.start(4407), fixture = await seedFinalHome(runtime.db, api)
  const source = { id: 'many', kind: 'manual', label: 'Selección manual', productIds: fixture.products.map(p => p.id), href: '/catalogo' }
  const layout = { sections: [
    { id: 'many', type: 'products', title: 'Muchos productos', limit: 8, sources: [source, { ...source, id: 'few', label: 'Pocos productos', productIds: [fixture.products[2].id] }], panel: { title: 'Panel editorial configurado', description: 'Información de prueba para acompañar una selección de accesorios.', label: 'Explorar catálogo', href: '/catalogo' } },
    { id: 'split', type: 'splitRow', ratio: '50/50', reverse: true, bannerId: 'qa-editorial', panelKind: 'categories', categorySlugs: fixture.categories.map(c => c.slug), limit: 4 },
    { id: 'campaign', type: 'campaign', title: 'Campaña exclusivamente sintética', endsAt: '2035-01-01T00:00:00.000Z', limit: 1, source: { ...source, productIds: [fixture.products[2].id] } },
    { id: 'inline', type: 'inlineBanners', slot: 'workspace' },
    { id: 'support', type: 'supportLinks', title: 'Soporte compartido' },
    { id: 'legal', type: 'legalText', title: 'Texto legal de prueba', text: 'Contenido extenso, editable y sin condiciones comerciales de prueba. '.repeat(20) },
    { id: 'empty', type: 'editorialTiles', columns: 4, items: [] },
    { id: 'inactive', type: 'benefits', active: false, items: [{ id: 'i', icon: 'info', title: 'Inactivo', text: 'No debe verse' }] },
  ] }
  const response = await fetch(`${api}/api/admin/home-layout`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${runtime.auth(runtime.admin)}` }, body: JSON.stringify(layout) })
  assert.equal(response.status, 200)
  process.chdir(runtime.root)
  vite = await createServer({ root: runtime.root, configFile: join(runtime.root, 'vite.config.js'), envFile: false, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, server: { host: '127.0.0.1', port: 5177, strictPort: true } }); await vite.listen()
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, chromiumSandbox: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage(); page.on('pageerror', e => results.errors.push(e.message))
  await page.goto('http://127.0.0.1:5177'); await page.getByRole('heading', { name: 'Muchos productos', exact: true }).waitFor()
  const productSection = page.locator('section[aria-labelledby="home-products-title-many"]')
  await productSection.getByRole('button', { name: 'Más productos', exact: true }).click()
  await page.waitForFunction(() => document.getElementById('home-products-panel-many').scrollLeft > 100)
  await productSection.getByRole('tab', { name: 'Selección manual', exact: true }).press('ArrowRight')
  assert.equal(await productSection.getByRole('tab', { name: 'Pocos productos', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await productSection.locator('#home-products-panel-many > div').count(), 1)
  await productSection.getByRole('tab', { name: 'Pocos productos', exact: true }).press('Home')
  await productSection.getByRole('tab', { name: 'Selección manual', exact: true }).press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Ver todo')
  assert.equal(await page.getByText('No debe verse', { exact: true }).count(), 0)
  results.checks.push('Carrusel desplaza ocho productos, cambia a uno con flechas de teclado y conserva panel; vacío/inactivo ocultos')
  if (longMode) {
    const copy = length => 'Contenido extenso de prueba para comprobar adaptación y lectura. '.repeat(120).slice(0, length).trim()
    const tile = (id, index = 0) => ({ id, title: copy(100), description: copy(500), image: `${api}/fixtures/product-${index}.svg`, imageAlt: copy(160), href: '/catalogo' })
    for (const category of fixture.categories) await runtime.db.category.update({ where: { id: category.id }, data: { name: copy(80) } })
    await runtime.db.brand.update({ where: { slug: 'qa-marca' }, data: { name: copy(100) } })
    const banners = (await runtime.db.siteSetting.findUnique({ where: { key: 'homeBanners' } })).value
    banners[1].title = copy(80); banners[1].description = copy(240)
    bannerSchema.parse(banners[1])
    await runtime.db.siteSetting.update({ where: { key: 'homeBanners' }, data: { value: banners } })
    const support = (await runtime.db.siteSetting.findUnique({ where: { key: 'cartFooterLinks' } })).value.map(item => ({ ...item, label: copy(80) }))
    await runtime.db.siteSetting.update({ where: { key: 'cartFooterLinks' }, data: { value: support } })
    const sections = [
      { ...layout.sections[1], title: copy(100) },
      { id: 'tiles-long', type: 'editorialTiles', columns: 5, title: copy(100), items: Array.from({ length: 5 }, (_, i) => tile(`tile-${i}`, i)) },
      { id: 'brands-long', type: 'brands', title: copy(100), limit: 24 },
      { id: 'benefits-long', type: 'benefits', title: copy(100), items: Array.from({ length: 4 }, (_, i) => ({ id: `benefit-${i}`, icon: 'info', title: copy(100), text: copy(500) })) },
      { id: 'support-long', type: 'supportLinks', title: copy(100) },
      { id: 'legal-long', type: 'legalText', title: copy(100), text: copy(6000) },
      { id: 'use-long', type: 'useSelections', title: copy(100), tabs: Array.from({ length: 8 }, (_, i) => ({ id: `tab-${i}`, label: `${i + 1}. ${copy(56)}`, image: `${api}/fixtures/scene-${i}.svg`, imageAlt: copy(160), links: Array.from({ length: 6 }, (_, j) => tile(`link-${i}-${j}`, j)) })) },
    ]
    const saved = await fetch(`${api}/api/admin/home-layout`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${runtime.auth(runtime.admin)}` }, body: JSON.stringify({ sections }) })
    assert.equal(saved.status, 200)
    const home = await (await fetch(`${api}/api/home`)).json()
    assert.deepEqual(home.sections.map(s => s.type), sections.map(s => s.type))
    assert.ok(home.sections[0].banner, 'El banner extenso debe ser válido y llegar al resolver')
    results.checks.push('Siete tipos 5b con contenido largo resueltos por API real; cinco tiles, cuatro beneficios, ocho pestañas y seis accesos por pestaña')
  }
  for (const [width, height] of process.argv.includes('--footer-only') ? [] : [[390, 844], [1440, 1000]]) {
    await page.setViewportSize({ width, height })
    for (const dark of [false, true]) {
      await page.evaluate(dark => localStorage.setItem('tecruta:theme', JSON.stringify(dark ? 'dark' : 'light')), dark)
      await page.reload(); await page.waitForSelector('main h2')
      await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, dark)
      let index = 1
      for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += Math.floor(height * .8)) {
        await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(300)
        const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollY, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }))
        assert.equal(metrics.scrollWidth, metrics.clientWidth)
        const name = `${longMode ? 'contenido-largo' : 'variantes'}-${width}-${dark ? 'oscuro' : 'claro'}-${String(index++).padStart(2, '0')}`
        await page.screenshot({ path: join(evidence, `${name}.jpg`), type: 'jpeg', quality: 85 }); results.viewports.push({ name, ...metrics })
        if (await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 1)) break
      }
    }
  }
  if (!process.argv.includes('--footer-only')) results.checks.push(longMode ? 'Siete tipos 5b con contenido largo en móvil/escritorio y ambos temas sin overflow' : 'Panel lateral, fila invertida 50/50, campaña, banner inline, soporte y texto extenso: móvil/escritorio en ambos temas sin overflow')
  for (const [width, height] of longMode ? [] : [[390, 844], [1440, 1000]]) {
    await page.setViewportSize({ width, height })
    for (const dark of [false, true]) {
      await page.evaluate(dark => localStorage.setItem('tecruta:theme', JSON.stringify(dark ? 'dark' : 'light')), dark)
      await page.reload(); await page.locator('footer form').waitFor()
      await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, dark)
      const footer = page.locator('footer')
      await footer.scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
      const color = await footer.locator('input[type="email"]').evaluate(el => getComputedStyle(el, '::placeholder').color)
      if (dark) assert.match(color, /rgba?\(250, 250, 249/)
      const name = `footer-completo-${width}-${dark ? 'oscuro' : 'claro'}`
      const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, scrollY, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }))
      assert.equal(metrics.scrollWidth, metrics.clientWidth)
      await footer.screenshot({ path: join(evidence, `${name}.jpg`), type: 'jpeg', quality: 85 })
      results.viewports.push({ name, ...metrics, placeholderColor: color, element: 'footer completo' })
    }
  }
  if (!longMode) results.checks.push('Footer completo y placeholder legible en oscuro')
  assert.deepEqual(results.errors, [])
  console.log(JSON.stringify({ checks: results.checks, captures: results.viewports.length }))
} catch (error) { results.failure = error.stack; throw error }
finally { writeFileSync(join(evidence, longMode ? 'resultados-largos.json' : process.argv.includes('--footer-only') ? 'resultados-footer.json' : 'resultados-variantes.json'), JSON.stringify(results, null, 2)); if (browser) await browser.close(); if (vite) await vite.close(); await runtime.close() }
