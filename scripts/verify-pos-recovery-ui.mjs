import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPanelPreview } from './lib/panel-preview-runtime.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(join(process.env.TECRUTA_QA_TOOLS || join(tmpdir(), 'tecruta-home-final-tools/node_modules'), 'playwright-core'))
const rt = await createPanelPreview({ panelPort: 5202, storePort: 5203 })
const evidence = join(rt.root, 'docs/operacion-rapida/evidencia'), checks = [], errors = []
mkdirSync(evidence, { recursive: true })
let browser, page
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  page = await context.newPage(); page.setDefaultTimeout(25000); page.on('pageerror', e => errors.push(e.message))
  const check = text => { checks.push(text); console.log(text) }
  const capture = async name => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.waitForTimeout(200); await page.screenshot({ path: join(evidence, name + '.png'), fullPage: true, animations: 'disabled' }) }
  const nav = name => page.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name, exact: true })
  const login = async username => {
    await page.goto(rt.panel + '/iniciar-sesion'); await page.evaluate(() => { localStorage.removeItem('tecruta:token'); sessionStorage.removeItem('tecruta:token') }); await page.reload()
    await page.getByRole('textbox', { name: 'Usuario', exact: true }).fill(username); await page.getByLabel('Contraseña', { exact: true }).fill(rt.password); await page.getByLabel('Recordar sesión en este equipo').check(); await page.getByRole('button', { name: 'Ingresar al panel', exact: true }).click()
  }
  const scan = async () => { const input = page.getByLabel('Escanear código', { exact: true }); await input.fill('0000123456789'); await input.press('Enter'); await page.getByLabel('Cantidad Cable USB-C de prueba').waitFor() }
  await login('cajerolocal'); await nav('Mi caja').click(); await page.getByLabel('Saldo inicial', { exact: true }).fill('100.00'); await page.getByRole('button', { name: 'Abrir turno', exact: true }).click(); await page.getByText('● Caja abierta', { exact: true }).waitFor(); await nav('Vender').click(); await scan()
  await page.getByRole('button', { name: 'Importe exacto', exact: true }).click()
  assert.equal(await page.getByLabel('Importe pago 1').inputValue(), '19.90'); assert.equal(await page.getByLabel('Efectivo recibido', { exact: true }).inputValue(), '19.90'); assert.equal(await page.getByLabel('Conté y recibí este efectivo.').isChecked(), false)
  await page.getByLabel('Conté y recibí este efectivo.').check(); await page.getByRole('button', { name: 'Recibido S/ 50 pago 1', exact: true }).click(); assert.equal(await page.getByLabel('Conté y recibí este efectivo.').isChecked(), false)
  await page.getByText('Vuelto: S/ 30.10', { exact: true }).waitFor()
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('tecruta:pos-draft:' + id)), rt.cashier.id)
  assert.equal(saved.items[0].quantity, 1); assert.equal(saved.payments, undefined); assert.equal(saved.customer, undefined); assert.equal(saved.items[0].price, undefined)
  await rt.db.product.update({ where: { id: rt.products[0].id }, data: { price: '24.90' } })
  await page.reload(); await page.getByRole('button', { name: 'Recuperar carrito', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Confirmar venta y cobro', exact: true }).isEnabled(), false)
  await page.getByRole('button', { name: 'Recuperar carrito', exact: true }).click(); await page.getByText('Revisé los precios y existencias recuperados.', { exact: true }).waitFor()
  await page.getByTestId('pos-total').getByText('S/ 24.90', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Importe pago 1').inputValue(), ''); assert.equal(await page.getByLabel('Conté y recibí este efectivo.').isChecked(), false)
  await capture('carrito-recuperado-precio-actual'); await page.getByLabel('Revisé los precios y existencias recuperados.').click()
  for (const [device, width, height] of [['escritorio',1440,1000],['tablet',834,1112]]) { await page.setViewportSize({width,height}); for (const theme of ['light','dark']) { await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme); await capture(`atajos-${device}-${theme}`) } }
  await page.setViewportSize({width:1440,height:1000})
  check('Carrito por cuenta sin pagos/datos de cliente; recarga recupera precio actualizado y exige revisión explícita')
  await page.getByRole('button', { name: 'Añadir método de pago', exact: true }).click(); await page.getByLabel('Importe pago 2').fill('10.00'); await page.getByRole('button', { name: 'Importe exacto', exact: true }).click(); assert.equal(await page.getByLabel('Importe pago 1').inputValue(), '14.90'); await page.getByRole('button', { name: 'Recibido S/ 20 pago 1' }).click(); await page.getByText('Vuelto: S/ 5.10', { exact: true }).waitFor()
  check('Atajos de efectivo calculan céntimos y saldo de pagos combinados; no verifican el dinero automáticamente')
  await login('adminlocal'); await page.getByRole('heading', { name: 'Resumen', exact: true }).waitFor(); await nav('Vender').click(); assert.equal(await page.getByRole('button', { name: 'Recuperar carrito', exact: true }).count(), 0)
  await login('cajerolocal'); await page.getByRole('button', { name: 'Recuperar carrito', exact: true }).click(); await page.getByLabel('Revisé los precios y existencias recuperados.').click()
  check('Cambio de cuenta no revela ni mezcla el carrito; al regresar a su cuenta puede recuperarlo')
  await page.getByRole('button', { name: 'Importe exacto', exact: true }).click(); await page.getByLabel('Conté y recibí este efectivo.').check()
  let intercepted = false
  let resolveCommit
  const committed = new Promise(resolve => { resolveCommit = resolve })
  await page.route('**/api/pos/sales', async route => { if (route.request().method() !== 'POST' || intercepted) return route.continue(); intercepted = true; const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('failed'); resolveCommit() })
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Confirmar venta y cobro', exact: true }).click(); await page.getByRole('button', { name: 'Recuperar mismo intento', exact: true }).waitFor()
  await committed; assert.equal(await rt.db.posSale.count(), 1); const operation = await page.evaluate(id => JSON.parse(localStorage.getItem('tecruta:pos-attempt:' + id)), rt.cashier.id); assert(operation.body.requestId)
  await page.close(); page = await context.newPage(); page.setDefaultTimeout(25000); page.on('pageerror', e => errors.push(e.message)); await login('cajerolocal'); await page.getByRole('button', { name: 'Recuperar mismo intento', exact: true }).click(); await page.getByRole('button', { name: 'Imprimir ticket interno', exact: true }).waitFor()
  assert.equal(await rt.db.posSale.count(), 1); assert.equal((await rt.db.product.findUnique({ where: { id: rt.products[0].id } })).stock, 19)
  assert.equal(await page.evaluate(id => localStorage.getItem('tecruta:pos-attempt:' + id), rt.cashier.id), null); assert.equal(await page.evaluate(id => localStorage.getItem('tecruta:pos-draft:' + id), rt.cashier.id), null)
  await capture('cobro-recuperado-sin-duplicados'); check('Respuesta perdida tras COMMIT y cierre completo de pestaña: mismo intento, una venta, un descuento de stock')
  await scan(); await page.reload(); const twin = await context.newPage(); await twin.goto(rt.panel + '/pos'); await twin.getByRole('button', { name: 'Recuperar carrito', exact: true }).click(); await twin.getByLabel('Revisé los precios y existencias recuperados.').click(); await page.getByRole('button', { name: 'Recuperar carrito', exact: true }).click(); await page.getByLabel('Revisé los precios y existencias recuperados.').click()
  for (const current of [page, twin]) { await current.getByRole('button', { name: 'Importe exacto', exact: true }).click(); await current.getByLabel('Conté y recibí este efectivo.').check() }
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Confirmar venta y cobro', exact: true }).click(); await page.getByRole('button', { name: 'Imprimir ticket interno', exact: true }).waitFor()
  twin.once('dialog', dialog => dialog.accept()); await twin.getByRole('button', { name: 'Confirmar venta y cobro', exact: true }).click(); await twin.getByRole('button', { name: 'Imprimir ticket interno', exact: true }).waitFor()
  assert.equal(await rt.db.posSale.count(), 2); await twin.close(); check('Dos pestañas recuperan el mismo carrito y lo envían: clave estable evita doble venta')
  await scan(); await page.evaluate(id => { const key='tecruta:pos-draft:'+id; const value=JSON.parse(localStorage.getItem(key)); value.updatedAt=Date.now()-8*86400000; localStorage.setItem(key,JSON.stringify(value)) },rt.cashier.id); await page.reload(); await page.getByRole('button',{name:'Recuperar carrito',exact:true}).waitFor(); assert.equal(await page.getByRole('button',{name:'Recuperar carrito',exact:true}).isEnabled(),false); page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Descartar carrito guardado',exact:true}).click()
  await page.evaluate(id=>localStorage.setItem('tecruta:pos-attempt:'+id,'{corrupto'),rt.cashier.id);await page.reload();await page.getByText('No se pudo leer la recuperación local.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Confirmar venta y cobro',exact:true}).isEnabled(),false);assert.equal(await rt.db.posSale.count(),2);await page.evaluate(id=>localStorage.removeItem('tecruta:pos-attempt:'+id),rt.cashier.id)
  check('Carrito vencido no se recupera y un intento corrupto bloquea operaciones sin crear ventas')
  await login('adminlocal'); await page.getByRole('heading', { name: 'Resumen', exact: true }).waitFor(); await page.getByRole('link', { name: /Atender .* pedidos pendientes/ }).click(); assert.equal(new URL(page.url()).searchParams.get('estado'), 'PENDING')
  await nav('Más').click(); await page.getByRole('link', { name: /^ProductosCrear/ }).count(); await page.locator('main a[href="/productos"]').click(); await page.getByPlaceholder('Buscar por nombre o slug…').fill('Cable'); await nav('Inicio').click(); await nav('Más').click(); await page.locator('main a[href="/productos"]').click(); assert.equal(await page.getByPlaceholder('Buscar por nombre o slug…').inputValue(), 'Cable')
  await nav('Inventario').click(); await page.getByPlaceholder('Buscar nombre o SKU').fill('Cargador'); await nav('Inicio').click(); await nav('Inventario').click(); assert.equal(await page.getByPlaceholder('Buscar nombre o SKU').inputValue(), 'Cargador')
  await nav('Inicio').click(); await page.getByRole('link', { name: 'Ver productos con stock bajo', exact: true }).click(); await page.getByRole('heading', { name: 'Reportes del negocio', exact: true }).waitFor(); assert.equal(await page.getByLabel('Reporte', { exact: true }).inputValue(), 'low-stock')
  await capture('alertas-y-reportes'); check('Búsquedas de catálogo/inventario persistentes; pendientes y stock bajo abren el filtro correcto')
  await nav('Inicio').click();await page.getByRole('link',{name:'Revisar cajas abiertas',exact:true}).click();await page.getByRole('heading',{name:'Mi turno de caja',exact:true}).waitFor();assert.equal(await page.getByLabel('Filtrar turnos').inputValue(),'OPEN')
  const {createOrder}=await rt.load('server/src/lib/orderService.js');const created=await createOrder(rt.db,{customer:{nombre:'Pedido',apellido:'Sintético',correo:'qa-actions@example.test',celular:'999999999'},delivery:{tipoEntrega:'recojo',departamento:'Lima',provincia:'Lima',distrito:'Lima'},items:[{productId:rt.products[1].id,quantity:1}]},null,crypto.randomUUID(),'synthetic-only-secret')
  await page.goto(rt.panel+'/pedidos?buscar='+created.order.id);await page.getByRole('link',{name:'Verificar y registrar cobro',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Registrar despacho',exact:true}).count(),0)
  // Synthetic paid legacy order fixture; this test does not simulate a real payment/provider.
  await rt.db.order.update({where:{id:created.order.id},data:{status:'PAID'}});await page.reload();await page.getByRole('button',{name:'Registrar despacho',exact:true}).waitFor();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Registrar despacho',exact:true}).click();await page.getByRole('button',{name:'Registrar entrega',exact:true}).waitFor();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Registrar entrega',exact:true}).click();await page.getByText('Entrega finalizada.',{exact:true}).waitFor();assert.equal((await rt.db.order.findUnique({where:{id:created.order.id}})).status,'DELIVERED');await capture('siguiente-paso-pedido')
  check('Acceso de cajas filtra abiertos; pedido pendiente guía al cobro y pedido pagado permite despacho/entrega con API real aislada')
  assert.equal(errors.length, 0, errors.join('\n'))
} catch (error) { await page?.screenshot({ path: join(evidence, 'fallo.png'), fullPage: true }).catch(() => {}); throw error }
finally { writeFileSync(join(evidence, 'resultados.json'), JSON.stringify({ at: new Date().toISOString(), checks, errors }, null, 2)); await browser?.close(); await rt.close() }
