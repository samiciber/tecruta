import assert from 'node:assert/strict'
import test from 'node:test'
import { createFinalHomeRuntime } from './helpers/final-home-runtime.mjs'
import { seedFinalHome } from './helpers/final-home-fixtures.mjs'
import { homeLayoutSchema } from '../../src/lib/homeSchemas.js'

test('footer, layout preview and newsletter persist in disposable PostgreSQL with real routes', async () => {
  const runtime = await createFinalHomeRuntime()
  let base = await runtime.start()
  const request = async (path, { role, method = 'GET', body } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${runtime.auth(role === 'admin' ? runtime.admin : runtime.customer)}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() }
  }
  try {
    for (const path of ['/api/admin/footer-content', '/api/admin/newsletter/subscribers', '/api/admin/newsletter/export.csv']) {
      assert.equal((await request(path)).status, 401)
      assert.equal((await request(path, { role: 'customer' })).status, 403)
    }
    const config = (await request('/api/admin/footer-content', { role: 'admin' })).data
    config.footer.description = 'Descripción persistida de prueba.'
    assert.equal((await request('/api/admin/footer-content', { role: 'admin', method: 'PUT', body: config })).status, 200)
    const invalid = structuredClone(config); invalid.footer.groups[0].links[0].href = 'javascript:alert(1)'
    assert.equal((await request('/api/admin/footer-content', { role: 'admin', method: 'PUT', body: invalid })).status, 400)
    assert.deepEqual((await request('/api/admin/footer-content', { role: 'admin' })).data, config)
    assert.equal((await request('/api/footer')).data.description, config.footer.description)
    const fixture = await seedFinalHome(runtime.db, base)
    const manual = { id: 'manual-test', label: 'Manual', kind: 'manual', productIds: fixture.products.map(p => p.id), href: '/catalogo' }
    const allTypes = homeLayoutSchema.parse({ sections: [
      ...fixture.layout.sections.filter(s => s.type !== 'campaign'),
      { id: 'products', type: 'products', title: 'Productos con panel', limit: 2, sources: [manual], panel: { title: 'Panel preservado', label: 'Explorar', href: '/catalogo', description: 'Descripción '.repeat(15).trim() } },
      { id: 'campaign', type: 'campaign', title: 'Campaña sintética', endsAt: '2035-01-01T00:00:00.000Z', source: manual, limit: 3 },
      { id: 'inline', type: 'inlineBanners', slot: 'workspace' },
      { id: 'support', type: 'supportLinks', title: 'Soporte compartido' },
      { id: 'legal', type: 'legalText', text: 'Contenido extenso de prueba. '.repeat(200) },
    ].map(s => ({ ...s, appearance: { tone: 'soft', density: 'compact' } })) })
    assert.equal((await request('/api/admin/home-layout', { role: 'admin', method: 'PUT', body: allTypes })).status, 200)
    assert.deepEqual((await request('/api/admin/home-layout', { role: 'admin' })).data.layout, allTypes)
    const publicAll = (await request('/api/home')).data
    assert.deepEqual(publicAll.sections.map(s => s.type), allTypes.sections.map(s => s.type))
    assert.ok(publicAll.sections.every(s => s.appearance.tone === 'soft'))
    assert.equal(publicAll.sections.find(s => s.id === 'products').panel.title, 'Panel preservado')
    assert.equal(publicAll.sections.find(s => s.id === 'products').tabs[0].products.length, 2)
    const inactive = { sections: allTypes.sections.map(s => ({ ...s, active: false })) }
    await request('/api/admin/home-layout', { role: 'admin', method: 'PUT', body: inactive })
    assert.deepEqual((await request('/api/home')).data.sections, [])
    assert.deepEqual((await request('/api/admin/home-layout', { role: 'admin' })).data.layout, inactive)
    const draft = { sections: [{ id: 'guest', type: 'guestStrip', active: true, message: 'Mensaje de prueba', buttonLabel: 'Entrar', href: '/iniciar-sesion', appearance: { tone: 'soft', density: 'compact' } }] }
    assert.equal((await request('/api/admin/home-layout', { role: 'admin', method: 'PUT', body: draft })).status, 200)
    const preview = await request('/api/admin/home-layout/preview', { role: 'admin', method: 'POST', body: draft })
    assert.equal(preview.status, 200); assert.equal(preview.data.sections[0].message, 'Mensaje de prueba'); assert.deepEqual(preview.data.sections[0].appearance, draft.sections[0].appearance)
    assert.equal((await request('/api/admin/home-layout/preview', { method: 'POST', body: draft })).status, 401)
    assert.equal((await request('/api/admin/home-layout/preview', { role: 'customer', method: 'POST', body: draft })).status, 403)
    const subscribe = body => request('/api/newsletter/subscribe', { method: 'POST', body })
    assert.equal((await subscribe({ email: 'bad', consent: true })).status, 400)
    assert.equal((await subscribe({ email: '  QA@Example.test ', consent: true })).status, 201)
    assert.equal((await subscribe({ email: 'qa@example.test', consent: true })).status, 409)
    assert.equal((await subscribe({ email: '+formula@example.test', consent: true })).status, 201)
    assert.equal((await subscribe({ email: 'no-consent@example.test', consent: false })).status, 400)
    assert.equal((await subscribe({ email: 'limited@example.test', consent: true })).status, 429)
    assert.equal(await runtime.db.newsletterSubscriber.count(), 2)
    const csv = await request('/api/admin/newsletter/export.csv', { role: 'admin' })
    assert.equal(csv.status, 200); assert.ok(csv.data.includes("\"'+formula@example.test\""))
    assert.equal((await request('/api/admin/newsletter/subscribers', { role: 'admin' })).data.total, 2)
    base = await runtime.restart()
    assert.equal((await request('/api/footer')).data.description, config.footer.description)
    assert.deepEqual((await request('/api/admin/home-layout', { role: 'admin' })).data.layout, draft)
    assert.equal((await request('/api/admin/newsletter/subscribers', { role: 'admin' })).data.total, 2)
    assert.equal((await runtime.db.newsletterSubscriber.findUnique({ where: { email: 'qa@example.test' } })).email, 'qa@example.test')
    assert.ok((await request('/api/legal/privacidad')).data.body.includes('suscribes'))
  } finally { await runtime.close() }
})
