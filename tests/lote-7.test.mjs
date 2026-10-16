import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLiveResource, invalidateLiveResources, invalidatedResourcesFor } from '../src/services/liveResource.js'
import { canAddProduct, reviewCart, validateProducts, validatePayments, normalizeCart } from '../src/utils/purchasePolicy.js'
import { resolveCatalogDetail } from '../src/services/catalogDetail.js'

const product = { id: 'qa-api-id', slug: 'qa', name: 'QA', price: 10, stock: 3, images: [] }
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve } }
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
test('successful mutation routes identify affected catalog/payment resources, including stock restored by cancellation', () => {
  for (const path of ['/api/admin/products/id', '/api/admin/products/assign', '/api/admin/brands/id', '/api/admin/category-tree/id', '/api/admin/orders/id/status', '/api/orders']) assert.deepEqual(invalidatedResourcesFor('PATCH', path), ['products', 'home'])
  assert.deepEqual(invalidatedResourcesFor('PATCH', '/api/admin/payment-methods/bankTransfer'), ['payment-methods'])
  assert.deepEqual(invalidatedResourcesFor('GET', '/api/admin/products'), [])
  assert.deepEqual(invalidatedResourcesFor('POST', '/api/auth/login'), [])
})
test('many readers share one request; only a successful API snapshot is purchasable', async () => {
  const pending = deferred(); let count = 0
  const resource = createLiveResource({ key: 'test-dedup', fetcher: () => { count++; return pending.promise } })
  const loads = Array.from({ length: 30 }, () => resource.load())
  assert.equal(canAddProduct(resource, product), false)
  await flush(); assert.equal(count, 1)
  pending.resolve([product]); await Promise.all(loads)
  assert.equal(resource.isFresh(), true); assert.equal(canAddProduct(resource, product), true)
  assert.equal(canAddProduct(resource, { ...product, id: 'static-id' }), false)
  assert.equal(canAddProduct(resource, { ...product, price: 9 }), false)
  assert.equal(canAddProduct(resource, product, 4), false)
  assert.equal(canAddProduct(resource, product, 1.5), false)
})
test('fallback is explicit and blocked, failed imports finish loading, retry recovers API data', async () => {
  let offline = true
  const resource = createLiveResource({ key: 'test-fallback', fetcher: () => offline ? Promise.reject(new Error('QA offline')) : [product], fallback: () => [{ ...product, id: 'static-id' }] })
  await resource.load(); assert.equal(resource.getSnapshot().source, 'fallback'); assert.equal(resource.getSnapshot().loading, false)
  assert.equal(canAddProduct(resource, resource.getSnapshot().data[0]), false)
  await assert.rejects(resource.fresh(), /actualizar/)
  offline = false; await resource.fresh(); assert.equal(resource.getSnapshot().source, 'api'); assert.equal(resource.isFresh(), true)
  const failed = createLiveResource({ key: 'test-import-fail', fetcher: () => Promise.reject(new Error('QA offline')), fallback: () => Promise.reject(new Error('QA missing chunk')) })
  await failed.load(); assert.equal(failed.getSnapshot().loading, false); assert.deepEqual(failed.getSnapshot().data, []); assert.equal(failed.isFresh(), false)
})
test('API failure preserves the last good API data but pauses purchases; empty success replaces it', async () => {
  let data = [product], offline = false
  const resource = createLiveResource({ key: 'test-stale', fetcher: () => offline ? Promise.reject(new Error('QA offline')) : data })
  await resource.load(); offline = true; await resource.load(true)
  assert.deepEqual(resource.getSnapshot().data, [product]); assert.equal(resource.getSnapshot().source, 'api'); assert.equal(resource.isFresh(), false)
  offline = false; data = []; await resource.fresh(); assert.deepEqual(resource.getSnapshot().data, []); assert.equal(resource.isFresh(), true)
})
test('TTL reloads a mounted resource without navigation and failed loads retry after backoff', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let count = 0, offline = false
  const resource = createLiveResource({ key: 'test-ttl', fetcher: () => { count++; if (offline) throw new Error('QA'); return [{ ...product, price: count }] }, ttl: 1000, retry: 200 })
  const stop = resource.subscribe(() => {})
  try {
    await flush(); assert.equal(count, 1)
    t.mock.timers.tick(1000); assert.equal(resource.isFresh(), false); await flush(); assert.equal(count, 2); assert.equal(resource.getSnapshot().data[0].price, 2)
    offline = true; t.mock.timers.tick(1000); await flush(); assert.equal(count, 3); assert.equal(resource.isFresh(), false)
    offline = false; t.mock.timers.tick(200); await flush(); assert.equal(count, 4); assert.equal(resource.isFresh(), true)
  } finally { stop() }
})
test('invalidation during a pending fetch discards its response and every waiter receives the newer revision', async () => {
  const first = deferred(); let count = 0
  const resource = createLiveResource({ key: 'test-invalidate', fetcher: () => ++count === 1 ? first.promise : [{ ...product, price: 20 }] })
  const pending = resource.load(); await flush(); invalidateLiveResources('test-invalidate')
  first.resolve([{ ...product, price: 1 }]); await pending
  assert.equal(count, 2); assert.equal(resource.getSnapshot().data[0].price, 20); assert.equal(resource.isFresh(), true)
})
test('timeout aborts an unresponsive API and clears loading, allowing a later retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let signal, stalled = true
  const resource = createLiveResource({ key: 'test-timeout', timeout: 100, fetcher: value => { signal = value; return stalled ? new Promise(() => {}) : [product] } })
  const pending = resource.load(); await flush(); t.mock.timers.tick(100); await pending
  assert.equal(signal.aborted, true); assert.equal(resource.getSnapshot().loading, false); assert.equal(resource.isFresh(), false)
  stalled = false; await resource.fresh(); assert.equal(resource.isFresh(), true)
})
test('invalid API lists are rejected and empty products/payment lists remain valid', () => {
  assert.deepEqual(validateProducts([]), []); assert.deepEqual(validatePayments([]), [])
  assert.deepEqual(validateProducts([product]), [product])
  for (const value of [null, {}, [{ ...product, price: '10' }], [product, product], [{ ...product, stock: -1 }]]) assert.throws(() => validateProducts(value))
  const payment = { key: 'qa', label: 'QA', config: {} }
  assert.deepEqual(validatePayments([payment, { ...payment, key: 'inactive', active: false }]), [payment])
  for (const value of [null, {}, [payment, payment], [{ ...payment, config: null }], [{ ...payment, config: { availableFor: 'not-a-list' } }]]) assert.throws(() => validatePayments(value))
})
test('raw cart IDs and quantities require review instead of being silently purchased as a partial cart', () => {
  const entries = [{ productId: product.id, quantity: 4 }, { productId: 'static-id', quantity: 1 }]
  assert.deepEqual(reviewCart(entries, [product]).map(p => p.reason), ['stock', 'missing'])
  assert.deepEqual(reviewCart([{ productId: product.id, quantity: 3 }], [product]), [])
  const duplicated = normalizeCart([{ productId: product.id, quantity: 2 }, { productId: product.id, quantity: 2 }])
  assert.deepEqual(duplicated, [{ productId: product.id, quantity: 4 }])
  assert.equal(reviewCart(duplicated, [product])[0].reason, 'stock')
})
test('detail uses the complete API DTO, handles missing products and catches absent fallback modules', async () => {
  assert.deepEqual(await resolveCatalogDetail({ entry: product, source: 'api', loadFallback: () => { throw new Error('must not run') } }), { status: 'ready', product })
  assert.deepEqual(await resolveCatalogDetail({ source: 'api' }), { status: 'not-found' })
  assert.deepEqual(await resolveCatalogDetail({ source: 'fallback' }), { status: 'error' })
  assert.deepEqual(await resolveCatalogDetail({ entry: product, source: 'fallback', loadFallback: () => Promise.reject(new Error('missing module')) }), { status: 'error' })
})
