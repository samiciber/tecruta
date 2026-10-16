import assert from 'node:assert/strict'
import test from 'node:test'
import { homeLayoutSchema } from '../src/lib/homeSchemas.js'
import { resolveHome } from '../src/lib/homeResolver.js'
import { footerSchema, footerDefaults, resolveFooter } from '../src/lib/footerContent.js'
import { csvCell } from '../src/routes/newsletter.routes.js'
import { invalidatedResourcesFor } from '../../src/services/liveResource.js'

test('manual sources keep selection order, panel, appearance and server bound', async () => {
  let query
  const rows = ['p2', 'p1'].map(id => ({ id, slug: id, name: id, image: '/fixture.svg', price: 10, stock: 0, category: {}, images: [] }))
  const source = { id: 'manual', label: 'Selección', kind: 'manual', productIds: ['p1', 'p2', 'p3'], href: '/catalogo' }
  const appearance = { tone: 'soft', density: 'compact' }
  const panel = { title: 'Panel', description: 'Texto', label: 'Ver', href: '/catalogo' }
  const layout = homeLayoutSchema.parse({ sections: [{ id: 'products', type: 'products', title: 'Manual', limit: 2, sources: [source], appearance, panel }] })
  const result = await resolveHome({ db: { product: { findMany: async value => { query = value; return rows } } }, layout })
  assert.deepEqual(query.where.id.in, ['p1', 'p2']); assert.equal(query.take, 2)
  assert.deepEqual(result.sections[0].tabs[0].products.map(p => p.id), ['p1', 'p2'])
  assert.deepEqual(result.sections[0].panel, panel); assert.deepEqual(result.sections[0].appearance, appearance)
})

test('editable mobile images, alt text and maximum legal copy survive resolver', async () => {
  const item = { id: 'a', title: 'Título '.repeat(14).trim(), description: 'Texto '.repeat(80).trim(), image: '/desktop.svg', imageMobile: '/mobile.svg', imageAlt: 'Alternativa', href: '/catalogo' }
  const layout = homeLayoutSchema.parse({ sections: [
    { id: 'tiles', type: 'editorialTiles', columns: 4, items: Array.from({ length: 4 }, (_, i) => ({ ...item, id: `a${i}` })) },
    { id: 'use', type: 'useSelections', tabs: [{ id: 'tab', label: 'Mi espacio', image: '/space.svg', imageMobile: '/small.svg', imageAlt: 'Espacio', links: [item] }] },
    { id: 'legal', type: 'legalText', text: 'x'.repeat(6000) },
  ] })
  const result = await resolveHome({ db: {}, layout })
  assert.deepEqual(result.sections, layout.sections)
  assert.equal(homeLayoutSchema.safeParse({ sections: [{ id: 'legal', type: 'legalText', text: 'x'.repeat(6001) }] }).success, false)
})

test('footer visibility, shared support and unsafe destinations', () => {
  const config = structuredClone(footerDefaults)
  config.groups[0].visible = false
  const footer = resolveFooter({ footerContent: config, cartFooterLinks: [{ label: 'Ayuda', href: '/ayuda' }, { label: 'Pendiente', href: '/proximamente' }] })
  assert.deepEqual(footer.groups.map(g => g.id), ['ayuda'])
  assert.equal(footer.groups[0].links.length, 1)
  for (const href of ['javascript:alert(1)', '//host.test', 'https://', 'https://user:pass@example.test', '/proximamente']) {
    const invalid = structuredClone(footerDefaults); invalid.groups[0].links[0].href = href
    assert.equal(footerSchema.safeParse(invalid).success, false, href)
  }
  for (const path of ['/api/admin/footer-content', '/api/admin/site-settings/footerContent']) assert.ok(invalidatedResourcesFor('PUT', path).includes('footer'))
  assert.ok(invalidatedResourcesFor('PUT', '/api/admin/footer-content').some(prefix => 'legal-privacidad'.startsWith(prefix)))
})

test('CSV neutralizes formula prefixes and quotes all cells', () => {
  for (const value of ['=1+1', '+x@example.test', '-x', '@x', '  =2', '\tx']) assert.ok(csvCell(value).startsWith('"\''))
  assert.equal(csvCell('a"b,c'), '"a""b,c"')
})
