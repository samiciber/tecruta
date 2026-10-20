import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createShareHandler, createSitemapHandler } from '../../serverless/seo.js'
import { canonicalUrl, pageMetadata, productStructuredData, organizationStructuredData, safeJsonLd } from '../../src/utils/seo.js'
import { reviewJsonLd } from '../../src/utils/reviewJsonLd.js'

const origin = 'https://shop.example.test'
const product = { id: 'qa-product', slug: 'audifonos-qa', sku: '001-QA', name: 'Audífonos QA <script>', shortDescription: 'Descripción sintética QA', brand: 'Marca QA', price: 19.9, stock: 2, image: 'https://res.cloudinary.com/qa/image/upload/v1/qa.jpg', ratingCount: 0, ratingSum: 0 }
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(body = '') { this.body = body } })
const request = path => ({ url: '/api/share?path=' + encodeURIComponent(path), method: 'GET', headers: { host: 'shop.example.test' } })
const load = async path => {
  if (path.startsWith('/api/products/')) return product
  if (path.startsWith('/api/categories/')) return { name: 'Audio QA', slug: 'audio-qa', image: product.image }
  if (path === '/api/brands') return { all: [{ slug: 'marca-qa', name: 'Marca QA', logo: product.image }] }
  if (path === '/api/site-settings') return { storeBusiness: {} }
  throw Error('Unexpected path: ' + path)
}
test('metadatos únicos, canonical sin query y páginas privadas noindex', () => {
  const metadata = ['/','/catalogo','/marcas','/ayuda','/legal/terminos','/legal/privacidad'].map(path => pageMetadata(path, { origin }))
  assert.equal(new Set(metadata.map(row => row.title)).size, metadata.length)
  assert.equal(new Set(metadata.map(row => row.description)).size, metadata.length)
  for (const path of ['/mi-cuenta','/checkout','/carrito','/mis-pedidos','/admin','/pos','/iniciar-sesion']) assert.equal(pageMetadata(path, { origin }).noindex, true)
  assert.equal(canonicalUrl('/catalogo?q=qa#list', origin), origin + '/catalogo')
  assert.throws(() => canonicalUrl('//evil.example.test', origin))
  assert.equal(organizationStructuredData({}, origin), null)
  assert.equal(organizationStructuredData({ legalName: 'Empresa QA' }, origin).name, 'Empresa QA')
})
test('producto tiene precio PEN, SKU con ceros y stock; estrellas solo con datos reales', () => {
  const schema = productStructuredData(product, origin)
  assert.equal(schema.offers.price, '19.90')
  assert.equal(schema.offers.priceCurrency, 'PEN')
  assert.equal(schema.sku, '001-QA')
  assert.equal(schema.offers.availability, 'https://schema.org/InStock')
  assert.equal(schema.aggregateRating, undefined)
  assert.equal(productStructuredData({ ...product, stock: 0 }, origin).offers.availability, 'https://schema.org/OutOfStock')
  const rated = productStructuredData({ ...product, ratingCount: 2, ratingSum: 7 }, origin)
  assert.equal(rated.aggregateRating.ratingValue, 3.5)
  assert.equal(safeJsonLd(schema).includes('<script>'), false)
  const reviews = JSON.parse(reviewJsonLd(product, { summary: { count: 2, average: 3.5 }, items: [] }, origin))
  assert.equal(reviews['@id'], schema['@id'])
})
test('rastreadores reciben HTML escapado, OG/Twitter y JSON-LD desde datos públicos', async () => {
  for (const path of ['/producto/audifonos-qa','/categoria/audio-qa','/marca/marca-qa']) {
    const res = response()
    await createShareHandler({ load, origin })(request(path), res)
    assert.equal(res.statusCode, 200)
    assert.match(res.body, /property="og:title"/)
    assert.match(res.body, /name="twitter:card" content="summary_large_image"/)
    assert.ok(res.body.includes('f_auto,q_auto,c_limit,w_1200'))
    assert.equal(res.body.includes('QA <script>'), false)
    assert.match(res.headers['cache-control'], /no-store/)
    if (path.startsWith('/producto/')) {
      assert.match(res.body, /"@type":"Product"/)
      assert.equal(res.body.includes('aggregateRating'), false)
    }
  }
})
test('host del panel, rutas externas, traversal, privadas y fallos de API no se publican', async () => {
  for (const path of ['/mi-cuenta','https://evil.example.test','/producto/..','/producto/a%2Fb']) {
    const res = response()
    await createShareHandler({ load, origin })(request(path), res)
    assert.equal(res.statusCode, 404)
  }
  const denied = response()
  await createShareHandler({ load, origin })({ ...request('/'), headers: { host: 'panel.example.test' } }, denied)
  assert.equal(denied.statusCode, 404)
  const failed = response()
  await createShareHandler({ origin, load: async () => { throw Error('private internal error') } })(request('/producto/qa'), failed)
  assert.equal(failed.statusCode, 503)
  assert.equal(failed.body.includes('private internal error'), false)
  const noImage = response()
  await createShareHandler({ origin, load: async () => ({ name: 'Categoría QA sin imagen', slug: 'qa' }) })(request('/categoria/qa'), noImage)
  assert.equal(noImage.statusCode, 200)
  assert.match(noImage.body, /name="twitter:card" content="summary"/)
  assert.equal(noImage.body.includes('property="og:image"'), false)
})
test('sitemap solo publica URLs propias, excluye ocultos, limita tamaño y revalida con ETag', async () => {
  const source = async path => path.startsWith('/api/products') ? [product] : path.includes('/tree') ? [{ slug: 'audio-qa', visible: true, children: [] }] : { all: [{ slug: 'marca-qa', visible: true }, { slug: 'oculta-qa', visible: false }] }
  const handler = createSitemapHandler({ origin, load: source })
  const res = response()
  await handler(request('/'), res)
  assert.equal(res.statusCode, 200)
  assert.match(res.body, /audifonos-qa/)
  assert.equal(res.body.includes('oculta-qa'), false)
  assert.equal(res.body.includes('checkout'), false)
  assert.match(res.headers['cache-control'], /s-maxage=60/)
  const unchanged = response()
  await handler({ ...request('/'), headers: { ...request('/').headers, 'if-none-match': res.headers.etag } }, unchanged)
  assert.equal(unchanged.statusCode, 304)
  const tooLarge = response()
  await createSitemapHandler({ origin, load: async path => path.startsWith('/api/products') ? Array.from({ length: 5001 }, (_, i) => ({ slug: 'qa-' + i })) : path.includes('/tree') ? [] : { all: [] } })(request('/'), tooLarge)
  assert.equal(tooLarge.statusCode, 503)
})
test('robots, cabeceras privadas y rewrites conservan recursos y funciones', () => {
  const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8')
  for (const path of ['/admin','/pos','/mi-cuenta','/carrito','/checkout']) assert.ok(robots.includes('Disallow: ' + path))
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url)))
  assert.equal(config.rewrites[0].destination, '/api/sitemap')
  assert.ok(config.rewrites.some(row => row.has?.some(condition => condition.key === 'user-agent')))
  assert.ok(config.headers.some(row => row.headers.some(header => header.key === 'X-Robots-Tag')))
})

test('legales vacíos no se indexan y nunca reciben un contrato de respaldo', async () => {
  for (const body of ['', '   ', 'Documento sintético QA: contenido configurado.']) {
    const res = response()
    await createShareHandler({ origin, load: async () => ({ title: 'Privacidad QA', body }) })(request('/legal/privacidad'), res)
    assert.equal(res.statusCode, 200)
    if (body.trim()) {
      assert.ok(res.body.includes(body))
      assert.equal(res.body.includes('noindex'), false)
    } else {
      assert.match(res.body, /noindex, follow/)
      assert.match(res.body, /Este documento aún no está publicado/)
    }
    assert.equal(res.body.includes('Aceptas'), false)
  }
})
