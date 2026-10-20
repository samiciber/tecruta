import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { gunzipSync } from 'node:zlib'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
import { resolveCatalogDetail } from '../../../src/services/catalogDetail.js'

let rt, base, product
before(async () => {
  rt = await createInventoryRuntime()
  product = await rt.product(5, { description: 'Descripción sintética para medición QA. '.repeat(400), specifications: [{ label: 'Dato QA', value: 'Valor sintético' }] })
  base = await rt.start()
}, { timeout: 180000 })
after(async () => { await rt?.close() })
const request = async (path, headers = {}) => {
  const res = await fetch(base + path, { headers })
  return { status: res.status, headers: res.headers, text: await res.text() }
}
test('lecturas públicas tienen ETag, caché acotada y 304; cambios de stock cambian el validador', async () => {
  const first = await request('/api/products?view=cards')
  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'public, max-age=0, s-maxage=30, stale-while-revalidate=60')
  const tag = first.headers.get('etag')
  assert.match(tag, /^W\//)
  const second = await request('/api/products?view=cards', { 'If-None-Match': tag })
  assert.equal(second.status, 304)
  assert.equal(second.text, '')
  const { createDraftMovement, confirmDraftMovement } = await rt.load('server/src/lib/inventoryService.js')
  const draft = await createDraftMovement(rt.db, { requestId: crypto.randomUUID(), productId: product.id, type: 'PURCHASE', direction: 'IN', quantity: 1, reason: 'Ingreso sintético QA', createdById: rt.admin.id })
  await confirmDraftMovement(rt.db, draft.id, rt.admin.id)
  const changed = await request('/api/products?view=cards', { 'If-None-Match': tag })
  assert.equal(changed.status, 200)
  assert.notEqual(changed.headers.get('etag'), tag)
})
test('carrito, pedidos, cuenta, POS, elegibilidad y cualquier autorización no usan caché pública', async () => {
  for (const path of ['/api/cart','/api/orders','/api/auth/me','/api/pos/config',`/api/reviews/products/${product.id}/eligibility`]) {
    const res = await request(path)
    assert.match(res.headers.get('cache-control'), /private, no-store/)
    assert.equal(res.headers.get('content-encoding'), null)
  }
  const authorized = await request('/api/products', { Authorization: 'Bearer ' + rt.auth(rt.customer) })
  assert.equal(authorized.status, 200)
  assert.match(authorized.headers.get('cache-control'), /private, no-store/)
  const cookie = await request('/api/products', { Cookie: 'qa=synthetic' })
  assert.match(cookie.headers.get('cache-control'), /private, no-store/)
  const missing = await request('/api/products/missing-qa')
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('cache-control'), /no-store/)
})
test('gzip negocia y reduce bytes públicos; cards reduce JSON sin quitar precio, stock ni ceros de SKU', async () => {
  const full = await request('/api/products')
  const cards = await request('/api/products?view=cards')
  const row = JSON.parse(cards.text)[0]
  assert.ok(Buffer.byteLength(cards.text) < Buffer.byteLength(full.text) / 4)
  assert.equal(row.summary, true)
  assert.equal(row.price, Number(product.price))
  assert.equal(row.stock, 6)
  assert.equal(row.description, undefined)
  assert.equal(JSON.parse(full.text)[0].description, product.description)
  const encoded = await new Promise((resolve, reject) => {
    http.get(base + '/api/products', { headers: { 'Accept-Encoding': 'gzip' } }, res => {
      const parts = []
      res.on('data', chunk => parts.push(chunk))
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(parts) }))
      res.on('error', reject)
    }).on('error', reject)
  })
  assert.equal(encoded.headers['content-encoding'], 'gzip')
  assert.ok(encoded.body.length < Buffer.byteLength(full.text) / 2)
  assert.deepEqual(JSON.parse(gunzipSync(encoded.body)), JSON.parse(full.text))
})
test('detalle completo desde cards respeta 404 y error; no utiliza resumen como ficha', async () => {
  const entry = { summary: true, slug: product.slug }
  const ready = await resolveCatalogDetail({ entry, source: 'api', fetchProduct: async () => product })
  assert.equal(ready.status, 'ready')
  assert.equal(ready.product.description, product.description)
  for (const [status, expected] of [[404, 'not-found'], [503, 'error']]) {
    const result = await resolveCatalogDetail({ entry, source: 'api', fetchProduct: async () => { throw Object.assign(Error('Synthetic API failure'), { status }) } })
    assert.equal(result.status, expected)
  }
})
