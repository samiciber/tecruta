import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productCreateSchema, productUpdateSchema, categoryCreateSchema, categoryUpdateSchema, paymentMethodUpdateSchema } from '../src/lib/adminSchemas.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const valid = { slug: 'Apple-Modelo_1', name: ' QA producto ', category: 'qa-category', price: 0.29, stock: 0 }
test('product price/stock accept zero and exact cents, reject invalid types, ranges and precision', () => {
  assert.equal(productCreateSchema.parse(valid).name, 'QA producto')
  for (const price of [0, 0.01, 19.99, 99999999.99]) assert.ok(productCreateSchema.safeParse({ ...valid, price }).success)
  for (const price of [-1, NaN, Infinity, '1', null, true, 100000000, 0.001]) assert.equal(productCreateSchema.safeParse({ ...valid, price }).success, false)
  for (const stock of [-1, 1.2, Infinity, '0', false, null, 2147483648]) assert.equal(productCreateSchema.safeParse({ ...valid, stock }).success, false)
  assert.ok(productUpdateSchema.safeParse({ price: 0, stock: 0 }).success)
})
test('product schemas reject extra fields, malformed lists, unsafe media and non-boolean flags', () => {
  for (const extra of [{ role: 'ADMIN' }, { categoryId: 'injected' }, { images: [''] }, { tags: 'bad' }, { featured: 'false' }, { bestSeller: 1 }, { image: 'javascript:alert(1)' }, { image: '//other.invalid/image' }, { image: '/\\other.invalid/image' }, { specifications: {} }, { hotspots: [{ x: 0, y: 0, z: Infinity, title: 'QA' }] }]) {
    assert.equal(productCreateSchema.safeParse({ ...valid, ...extra }).success, false)
  }
  const payload = { ...valid, brand: '', image: '', images: ['/qa.png', 'https://media.example.invalid/qa.png'], specifications: [{ label: 'Modelo', value: '' }], hotspots: null }
  const parsed = productCreateSchema.parse(payload)
  assert.equal(parsed.brand, null); assert.equal(parsed.image, null)
  assert.equal(productUpdateSchema.safeParse({}).success, false)
  assert.deepEqual(productUpdateSchema.parse({ images: [], specifications: null }), { images: [], specifications: null })
})
test('legacy category schemas trim input and refuse empty or unrecognized patch fields', () => {
  assert.deepEqual(categoryCreateSchema.parse({ slug: ' QA-cat ', name: ' QA ' }), { slug: 'QA-cat', name: 'QA' })
  for (const value of [{ name: '' }, { name: 1 }, { slug: 'new' }, {}, { visible: false }]) assert.equal(categoryUpdateSchema.safeParse(value).success, false)
  assert.deepEqual(categoryUpdateSchema.parse({ description: '' }), { description: null })
})
test('payment patches require real booleans and an object of JSON configuration', () => {
  assert.deepEqual(paymentMethodUpdateSchema.parse({ active: false }), { active: false })
  for (const value of [{ active: 'false' }, { active: 0 }, { label: '' }, { config: [] }, { config: null }, {}, { key: 'other' }]) assert.equal(paymentMethodUpdateSchema.safeParse(value).success, false)
  assert.ok(paymentMethodUpdateSchema.safeParse({ config: { phone: '000000000', options: { enabled: false } } }).success)
})
test('Prisma errors map to 409/404 without logging or exposing database/request details', () => {
  const original = console.error; const logs = []; console.error = (...args) => logs.push(args)
  try {
    for (const [code, expected] of [['P2002', 409], ['P2025', 404], ['P2003', 409]]) {
      let status, body
      const res = { status(value) { status = value; return this }, json(value) { body = value } }
      errorHandler(Object.assign(new Error('QA-private-request-detail'), { code, meta: { target: 'QA-private-request-detail' } }), {}, res)
      assert.equal(status, expected)
      assert.ok(!JSON.stringify(body).includes('QA-private-request-detail'))
      assert.deepEqual(Object.keys(body), ['error'])
    }
    assert.deepEqual(logs, [])
    let status, body
    const res = { status(value) { status = value; return this }, json(value) { body = value } }
    errorHandler(Object.assign(new Error('QA-private-request-detail'), { code: 'constructor' }), {}, res)
    assert.equal(status, 500)
    assert.deepEqual(body, { error: 'Error interno del servidor.' })
    assert.ok(!JSON.stringify(logs).includes('QA-private-request-detail'))
  } finally { console.error = original }
})
