import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { homeLayoutSchema, HOME_BENEFIT_ICONS } from '../src/lib/homeSchemas.js'
import { homeDefaults } from '../src/lib/homeDefaults.js'
import { resolveHome } from '../src/lib/homeResolver.js'
import { prisma } from '../src/lib/prisma.js'
import { contentRouter } from '../src/routes/content.routes.js'
import { adminContentRouter } from '../src/routes/adminContent.routes.js'
import { signToken } from '../src/lib/token.js'
import { invalidatedResourcesFor } from '../../src/services/liveResource.js'

const access = id => ({ id, title: `Acceso ${id}`, image: '/fixture.svg', href: '/catalogo' })
const tileSection = { id: 'tiles', type: 'editorialTiles', columns: 4, items: Array.from({ length: 4 }, (_, i) => access(`tile-${i}`)) }
const support = Array.from({ length: 5 }, (_, i) => ({ label: `Enlace existente ${i}`, href: `/ayuda#${i}` }))
const settings = { cartFooterLinks: support, homeBanners: [{ id: 'editorial', title: 'Editorial', imageDesktop: '/fixture.svg', active: true, placement: 'inline', slot: 'test' }] }
const product = { id: 'p', slug: 'p', name: 'Prueba', price: 10, stock: 2, featured: true, image: '/fixture.svg', category: {}, images: [] }
const sections = [
  { id: 'split', type: 'splitRow', ratio: '60/40', reverse: true, bannerId: 'editorial', panelKind: 'categories', categorySlugs: ['visible', 'hidden'] },
  tileSection,
  { id: 'brands', type: 'brands', limit: 3 },
  { id: 'benefits', type: 'benefits', items: [{ id: 'info', icon: 'info', title: 'Información', text: '<b>Texto plano</b>' }] },
  { id: 'support', type: 'supportLinks' },
  { id: 'legal', type: 'legalText', text: 'Texto legal\nSegunda línea' },
  { id: 'use', type: 'useSelections', tabs: [{ id: 'work', label: 'Trabajo', image: '/fixture.svg', links: [access('work-access')] }] },
]
function fakeDb(queries = []) {
  return {
    product: { findMany: async query => { queries.push(['products', query]); return [product] } },
    category: { findMany: async query => { queries.push(['categories', query]); return [{ slug: 'visible', name: 'Visible', image: null }] } },
    brand: { findMany: async query => { queries.push(['brands', query]); return [{ slug: 'real-brand', name: 'Marca real', logo: null }] } },
  }
}

test('5b schema preserves 5a defaults and bounds nested content, icons, sources and URLs', () => {
  assert.deepEqual(homeLayoutSchema.parse(homeDefaults), homeDefaults)
  assert.equal(homeLayoutSchema.parse({ sections }).sections.length, 7)
  for (const section of [
    { id: 'brands', type: 'brands', limit: 25 },
    { ...tileSection, items: [...tileSection.items, access('extra')] },
    { id: 'b', type: 'benefits', items: [{ id: 'x', icon: 'arbitrary-html', title: 'X', text: 'X' }] },
    { ...tileSection, items: [access('x'), access('x')] },
    { id: 'u', type: 'useSelections', tabs: [{ id: 'x', label: 'X', image: 'javascript:alert(1)', links: [] }] },
    { ...tileSection, items: [{ ...access('x'), href: '//other.test' }] },
    { id: 'split', type: 'splitRow', limit: 21 },
  ]) assert.equal(homeLayoutSchema.safeParse({ sections: [section] }).success, false)
  assert.equal(HOME_BENEFIT_ICONS.length, 8)
})

test('all seven types resolve public data, support reuses settings and brands use visible featured-first query', async () => {
  const queries = []
  const home = await resolveHome({ db: fakeDb(queries), layout: homeLayoutSchema.parse({ sections }), settings })
  assert.deepEqual(home.sections.map(s => s.id), sections.map(s => s.id))
  assert.equal(home.sections[0].ratio, '60/40')
  assert.equal(home.sections[0].reverse, true)
  assert.deepEqual(home.sections[0].panel.items.map(i => i.id), ['visible'])
  assert.equal(home.sections[0].banner.id, 'editorial')
  assert.deepEqual(home.sections[4].items, support)
  assert.equal(home.sections[3].items[0].text, '<b>Texto plano</b>')
  assert.equal(home.sections[2].items[0].href, '/marca/real-brand')
  const brandQuery = queries.find(([key]) => key === 'brands')[1]
  assert.deepEqual(brandQuery.where, { visible: true })
  assert.deepEqual(brandQuery.orderBy, [{ featured: 'desc' }, { featuredPosition: 'asc' }, { name: 'asc' }])
  assert.equal(brandQuery.take, 3)
  assert.equal(queries.find(([key]) => key === 'categories')[1].where.visible, true)
})

test('split rows keep surviving sides without placeholders and product limits are server-side', async () => {
  const queries = []
  const layout = homeLayoutSchema.parse({ sections: [
    { id: 'products', type: 'splitRow', panelKind: 'products', source: { id: 'f', label: 'Destacados', kind: 'featured' }, limit: 2 },
    { id: 'banner', type: 'splitRow', bannerId: 'editorial' },
    { id: 'empty', type: 'splitRow' },
  ] })
  const home = await resolveHome({ db: fakeDb(queries), layout, settings })
  assert.equal(home.sections[0].banner, null)
  assert.equal(home.sections[0].panel.products.length, 1)
  assert.equal(queries[0][1].take, 2)
  assert.equal(home.sections[1].panel, null)
  assert.deepEqual(home.states.map(s => s.visible), [true, true, false])
  assert.ok(home.states.every(s => s.reason))
})

test('empty and inactive 5b sections stay hidden with reasons and never query inactive sources', async () => {
  const layout = homeLayoutSchema.parse({ sections: [
    { id: 'split', type: 'splitRow' }, { id: 'tiles', type: 'editorialTiles' }, { id: 'brands', type: 'brands' },
    { id: 'benefits', type: 'benefits' }, { id: 'support', type: 'supportLinks' },
    { id: 'legal', type: 'legalText' }, { id: 'use', type: 'useSelections' },
    ...sections.map(s => ({ ...s, id: `${s.id}-inactive`, active: false })),
  ] })
  let brandQueries = 0
  const home = await resolveHome({ db: { brand: { findMany: async () => { brandQueries++; return [] } } }, layout })
  assert.deepEqual(home.sections, [])
  assert.equal(home.states.length, 14)
  assert.ok(home.states.every(s => !s.visible && s.reason))
  assert.equal(brandQueries, 1)
})

test('Home invalidates for each 5b source, including shared support links', () => {
  for (const path of ['/api/admin/brands/x', '/api/admin/categories/x', '/api/admin/products/x', '/api/admin/site-settings/cartFooterLinks', '/api/admin/site-settings/homeBanners', '/api/admin/home-layout']) {
    assert.ok(invalidatedResourcesFor('PUT', path).includes('home'), path)
  }
})

test('real ADMIN save/reload and public HTTP preserve 5b and 5a layouts with in-memory delegates', async () => {
  let stored = homeDefaults
  const db = fakeDb()
  const overrides = [
    [prisma.siteSetting, 'findMany', async () => Object.entries({ ...settings, homeLayout: stored }).map(([key, value]) => ({ key, value }))],
    [prisma.siteSetting, 'upsert', async ({ update }) => { stored = update.value; return { value: stored } }],
    [prisma.category, 'findMany', db.category.findMany], [prisma.brand, 'findMany', db.brand.findMany], [prisma.product, 'findMany', db.product.findMany],
    [prisma.user, 'findUnique', async () => ({ id: 'qa-admin', role: 'ADMIN', tokenVersion: 0 })],
  ]
  const originals = overrides.map(([delegate, key]) => [delegate, key, delegate[key]])
  const oldSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'local-home-5b-test-only'
  let server
  try {
    overrides.forEach(([delegate, key, value]) => { delegate[key] = value })
    const app = express(); app.use(express.json()); app.use('/api/admin', adminContentRouter); app.use('/api', contentRouter)
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    const base = `http://127.0.0.1:${server.address().port}`
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ sub: 'qa-admin', tokenVersion: 0 })}` }
    const layout = homeLayoutSchema.parse({ sections: [...homeDefaults.sections.filter(s => s.type === 'guestStrip'), ...sections] })
    assert.equal((await fetch(`${base}/api/admin/home-layout`, { method: 'PUT', headers, body: JSON.stringify(layout) })).status, 200)
    assert.deepEqual((await (await fetch(`${base}/api/admin/home-layout`, { headers })).json()).layout, layout)
    const publicHome = await (await fetch(`${base}/api/home`)).json()
    assert.deepEqual(publicHome.sections.map(s => s.id), layout.sections.map(s => s.id))
    assert.deepEqual(publicHome.sections.find(s => s.type === 'supportLinks').items, support)
    assert.equal((await fetch(`${base}/api/admin/home-layout`, { method: 'PUT', headers, body: JSON.stringify({ sections: [{ id: 'bad', type: 'brands', limit: 100 }] }) })).status, 400)
    assert.deepEqual(stored, layout)
    // Old saved layout is neither expanded nor activated by 5b.
    const oldLayout = { sections: [{ id: 'guest', type: 'guestStrip', active: false }] }
    await fetch(`${base}/api/admin/home-layout`, { method: 'PUT', headers, body: JSON.stringify(oldLayout) })
    assert.deepEqual(stored, oldLayout)
    assert.deepEqual((await (await fetch(`${base}/api/home`)).json()).sections, [])
  } finally {
    originals.forEach(([delegate, key, value]) => { delegate[key] = value })
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret
    if (server) await new Promise(resolve => server.close(resolve))
  }
})
