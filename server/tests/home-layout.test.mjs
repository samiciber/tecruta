import assert from 'node:assert/strict'
import express from 'express'
import test from 'node:test'
import { homeDefaults } from '../src/lib/homeDefaults.js'
import { homeLayoutSchema } from '../src/lib/homeSchemas.js'
import { resolveHome } from '../src/lib/homeResolver.js'
import { prisma } from '../src/lib/prisma.js'
import { signToken } from '../src/lib/token.js'
import { adminContentRouter } from '../src/routes/adminContent.routes.js'
import { contentRouter } from '../src/routes/content.routes.js'

const banner = (id, width = 'full') => ({
  id,
  title: `Banner ${id}`,
  imageDesktop: `https://images.example/${id}.webp`,
  placement: 'inline',
  width,
  slot: 'mid-home',
  active: true,
})

const product = (id, { featured = false, discount = false } = {}) => ({
  id,
  slug: id,
  name: `Producto ${id}`,
  brand: 'TecRuta',
  price: 100,
  compareAtPrice: discount ? 120 : null,
  stock: 3,
  featured,
  bestSeller: false,
  image: `https://images.example/${id}.webp`,
  images: [],
  category: { slug: 'accesorios' },
  brandRef: null,
})

test('home layout schema accepts defaults and rejects duplicate ids, missing source and unsafe links', () => {
  assert.equal(homeLayoutSchema.safeParse(homeDefaults).success, true)
  assert.equal(homeLayoutSchema.safeParse({ sections: [{ id: 'guest', type: 'guestStrip' }] }).success, true)
  assert.equal(homeLayoutSchema.safeParse({ sections: [{ id: 'a', type: 'hero' }, { id: 'a', type: 'circles' }] }).success, false)
  assert.equal(homeLayoutSchema.safeParse({
    sections: [{ id: 'products', type: 'products', title: 'Selección', sources: [{ id: 'cat', label: 'Categoría', kind: 'category' }] }],
  }).success, false)
  assert.equal(homeLayoutSchema.safeParse({
    sections: [{ id: 'products', type: 'products', title: 'Selección', sources: [{ id: 'tab', label: 'Todo', kind: 'featured', href: '//evil.example' }] }],
  }).success, false)
})

test('guest strip is configurable and inactive sections stay hidden', async () => {
  const layout = homeLayoutSchema.parse({
    sections: [
      { id: 'guest-active', type: 'guestStrip', active: true },
      { id: 'guest-disabled', type: 'guestStrip', active: false },
    ],
  })
  const result = await resolveHome({ db: { product: {}, category: {} }, layout })

  assert.deepEqual(result.sections, [{ id: 'guest-active', type: 'guestStrip' }])
  assert.deepEqual(result.states.map(({ visible, reason }) => ({ visible, reason })), [
    { visible: true, reason: null },
    { visible: false, reason: 'Sección desactivada en el diseño.' },
  ])
})

test('saved banners, circles and hero carousel settings remain compatible', async () => {
  const layout = homeLayoutSchema.parse({
    sections: [
      { id: 'hero', type: 'hero', active: true },
      { id: 'guest', type: 'guestStrip', active: true },
      { id: 'circles', type: 'circles', active: true },
    ],
  })
  const result = await resolveHome({
    db: { product: {}, category: { findMany: async () => [] } },
    layout,
    settings: {
      homeBanners: [{
        id: 'legacy-hero',
        title: 'Banner heredado',
        subtitle: 'Contenido previo',
        ctaLabel: 'Ver catálogo',
        href: '/catalogo',
        image: 'https://images.example/legacy.webp',
        active: true,
      }],
      homeCircles: {
        title: 'Círculos existentes',
        onlyWithProducts: false,
        items: [{ id: 'custom-circle', type: 'custom', label: 'Personalizado', href: '/catalogo', image: 'https://images.example/custom.webp' }],
      },
      heroCarousel: { intervalSeconds: 9, autoplay: false },
    },
  })

  assert.deepEqual(result.sections.map(({ id }) => id), ['hero', 'guest', 'circles'])
  assert.equal(result.hero.slides[0].imageDesktop, 'https://images.example/legacy.webp')
  assert.deepEqual(result.hero.config, { intervalSeconds: 9, autoplay: false })
  assert.equal(result.circles.title, 'Círculos existentes')
  assert.deepEqual(result.circles.items, [{
    key: 'custom-circle',
    label: 'Personalizado',
    to: '/catalogo',
    image: 'https://images.example/custom.webp',
    external: false,
  }])
})

test('home resolver returns only valid products and complete inline banner groups with visibility reasons', async () => {
  const productQueries = []
  const db = {
    product: {
      fields: { price: { field: 'price' } },
      findMany: async (query) => {
        productQueries.push(query)
        return [product('featured-item', { featured: true }), product('no-image', { featured: true, discount: true })]
          .map((row) => row.id === 'no-image' ? { ...row, image: null } : row)
      },
    },
    category: {
      findMany: async () => [{
        id: 'category-1', slug: 'accesorios', name: 'Accesorios', parentId: null,
        image: null, visible: true, legacy: false, _count: { products: 2 },
      }],
    },
  }
  const layout = homeLayoutSchema.parse({
    sections: [
      { id: 'hero', type: 'hero', active: true },
      { id: 'circles', type: 'circles', active: true },
      { id: 'empty', type: 'products', active: true, title: 'Con stock', limit: 3, sources: [{ id: 'tab', label: 'Destacados', kind: 'featured' }] },
      { id: 'inline', type: 'inlineBanners', active: true, slot: 'mid-home' },
      { id: 'disabled', type: 'campaign', active: false, title: 'Campaña', endsAt: '2035-01-01T00:00:00.000Z', source: { id: 'campaign-tab', label: 'Ofertas', kind: 'discount' } },
    ],
  })
  const result = await resolveHome({
    db,
    layout,
    settings: { homeBanners: [banner('pair-a', 'half'), banner('pair-b', 'half'), banner('orphan', 'half'), banner('full')] },
    now: new Date('2030-01-01T00:00:00.000Z'),
  })

  assert.deepEqual(result.sections.map((section) => section.id), ['circles', 'empty', 'inline'])
  assert.equal(result.hero, null)
  assert.equal(result.circles.items[0].label, 'Accesorios')
  assert.deepEqual(result.sections.find((section) => section.id === 'inline').groups.map((group) => group.banners.length), [2, 1])
  assert.equal(result.sections.find((section) => section.id === 'empty').tabs[0].products.length, 1)
  assert.equal(result.sections.find((section) => section.id === 'empty').tabs[0].products[0].image, 'https://images.example/featured-item.webp')
  assert.deepEqual(result.states.map((item) => item.visible), [false, true, true, true, false])
  assert.match(result.states[0].reason, /banners/)
  assert.match(result.states[4].reason, /desactivada/)
  assert.equal(productQueries[0].take, 3)
  assert.equal(productQueries[0].where.featured, true)
})

test('product panels survive the public JSON contract while optional and hidden sections stay compatible', async () => {
  const panel = { title: 'Encuentra accesorios', description: 'Selección para tu equipo', label: 'Explorar', href: '/catalogo' }
  const section = { type: 'products', title: 'Selección', sources: [{ id: 'featured', label: 'Destacados', kind: 'featured' }] }
  const layout = homeLayoutSchema.parse({ sections: [
    { ...section, id: 'with-panel', panel },
    { ...section, id: 'without-panel' },
    { ...section, id: 'disabled', active: false, panel },
    { ...section, id: 'empty', panel, sources: [{ id: 'best', label: 'Más vendidos', kind: 'bestSeller' }] },
  ] })
  const queries = []
  const db = { product: { findMany: async (query) => {
    queries.push(query)
    return query.where.featured ? [product('available', { featured: true })] : []
  } } }
  const result = JSON.parse(JSON.stringify(await resolveHome({ db, layout })))
  assert.deepEqual(result.sections.map(({ id }) => id), ['with-panel', 'without-panel'])
  assert.deepEqual(result.sections[0].panel, layout.sections[0].panel)
  assert.equal(Object.hasOwn(result.sections[1], 'panel'), false)
  assert.equal(result.sections[1].tabs[0].products[0].id, 'available')
  assert.deepEqual(result.states.map(({ visible }) => visible), [true, true, false, false])
  assert.match(result.states[2].reason, /desactivada/)
  assert.match(result.states[3].reason, /no tienen productos/)
  assert.equal(queries.length, 3)
})

test('expired campaigns are hidden without replacing the configured layout', async () => {
  const db = {
    product: { fields: { price: {} }, findMany: async () => [product('discount', { discount: true })] },
    category: { findMany: async () => [] },
  }
  const layout = homeLayoutSchema.parse({
    sections: [{ id: 'campaign', type: 'campaign', active: true, title: 'Campaña', endsAt: '2029-12-31T23:59:59.000Z', source: { id: 'tab', label: 'Ofertas', kind: 'discount' } }],
  })
  const result = await resolveHome({ db, layout, now: new Date('2030-01-01T00:00:00.000Z') })
  assert.deepEqual(result.sections, [])
  assert.match(result.states[0].reason, /venció/)
  assert.deepEqual(layout.sections.map((section) => section.id), ['campaign'])
})

test('Home GET routes resolve defaults with in-memory Prisma delegates and protect admin access', async () => {
  const overrides = [
    [prisma.siteSetting, 'findMany', async () => []],
    [prisma.product, 'findMany', async () => []],
    [prisma.category, 'findMany', async () => []],
    [prisma.category, 'findUnique', async () => null],
    [prisma.brand, 'findMany', async () => []],
    [prisma.user, 'findUnique', async () => ({ id: 'home-test-admin', role: 'ADMIN', tokenVersion: 0 })],
  ]
  const originals = overrides.map(([delegate, method]) => [delegate, method, delegate[method]])
  const app = express()
  app.use(express.json())
  app.use('/api', contentRouter)
  app.use('/api/admin', adminContentRouter)
  process.env.JWT_SECRET = 'home-route-test-only-secret'
  for (const [delegate, method, replacement] of overrides) delegate[method] = replacement

  let server
  try {
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const base = `http://127.0.0.1:${server.address().port}`
    const publicResponse = await fetch(`${base}/api/home`)
    const publicHome = await publicResponse.json()
    assert.equal(publicResponse.status, 200)
    assert.equal(publicResponse.headers.get('cache-control'), 'public, max-age=30, stale-while-revalidate=60')
    assert.equal(publicHome.states.length, homeDefaults.sections.length)
    assert.deepEqual(publicHome.sections, [{ id: 'guest-strip', type: 'guestStrip' }])
    assert.equal(publicHome.states.find((item) => item.id === 'guest-strip').visible, true)

    const unauthorized = await fetch(`${base}/api/admin/home-layout`)
    assert.equal(unauthorized.status, 401)

    const adminResponse = await fetch(`${base}/api/admin/home-layout`, {
      headers: { authorization: `Bearer ${signToken({ sub: 'home-test-admin', tokenVersion: 0 })}` },
    })
    const adminHome = await adminResponse.json()
    assert.equal(adminResponse.status, 200)
    assert.equal(adminHome.isDefault, true)
    assert.deepEqual(adminHome.layout, homeDefaults)
    assert.deepEqual(adminHome.sources, { categories: [], brands: [], banners: [] })
  } finally {
    for (const [delegate, method, original] of originals) delegate[method] = original
    delete process.env.JWT_SECRET
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
