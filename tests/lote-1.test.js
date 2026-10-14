import test from 'node:test'
import assert from 'node:assert/strict'
import { loadProductDetail } from '../src/services/productDetail.js'
import { addCartItemSchema, setCartItemQuantitySchema, createOrderSchema } from '../server/src/lib/schemas.js'

const product = { id: 'test-product', slug: 'test-product', category: 'cables' }
const offline = () => Promise.reject(new Error('Servicio no disponible'))

test('un 404 no recupera del respaldo un producto retirado', async () => {
  let fallbackCalls = 0
  const result = await loadProductDetail({
    slug: product.slug, entry: product,
    fetchProduct: () => Promise.reject(Object.assign(new Error('No encontrado'), { status: 404 })),
    loadFallback: async () => { fallbackCalls++; return [product] },
  })
  assert.equal(result.status, 'not-found')
  assert.equal(fallbackCalls, 0)
})

test('un producto nuevo puede cargarse aunque aún no figure en el índice', async () => {
  const result = await loadProductDetail({ slug: product.slug, fetchProduct: async () => product })
  assert.equal(result.status, 'ready')
  assert.equal(result.product, product)
})

test('un error de importación del respaldo acaba en error recuperable', async () => {
  const result = await loadProductDetail({
    slug: product.slug, entry: product, fetchProduct: offline,
    loadFallback: () => Promise.reject(new Error('Archivo no encontrado')),
  })
  assert.equal(result.status, 'error')
})

test('un respaldo sin ese slug no queda cargando ni sustituye otro producto', async () => {
  const result = await loadProductDetail({
    slug: product.slug, entry: product, fetchProduct: offline,
    loadFallback: async () => [{ ...product, slug: 'otro-producto' }],
  })
  assert.equal(result.status, 'error')
})

test('un respaldo válido sigue funcionando en una caída de la API', async () => {
  const result = await loadProductDetail({
    slug: product.slug, entry: product, fetchProduct: offline,
    loadFallback: async () => [product],
  })
  assert.equal(result.status, 'ready')
  assert.equal(result.product, product)
})

test('los tres schemas legados rechazan cantidades de tipo incorrecto en español', () => {
  for (const schema of [addCartItemSchema, setCartItemQuantitySchema, createOrderSchema.shape.items.element]) {
    const result = schema.safeParse({ productId: product.id, quantity: 'dos' })
    assert.equal(result.success, false)
    assert.equal(result.error.issues.find((issue) => issue.path.includes('quantity')).message, 'La cantidad debe ser un número.')
  }
})

test('cantidades fraccionarias conservan la restricción y un error localizado', () => {
  const result = addCartItemSchema.safeParse({ productId: product.id, quantity: 1.5 })
  assert.equal(result.success, false)
  assert.match(result.error.issues[0].message, /entero/i)
})
