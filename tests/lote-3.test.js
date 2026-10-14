import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateItems, canTransition, hashSecret, receiptAllowed, ORDER_STATUSES } from '../server/src/lib/orderPolicy.js'
import { decodeDataUrl, validateUpload, validateModel, IMAGE_MAX_BYTES } from '../server/src/lib/uploadValidation.js'
import { loadAttempt, saveAttempt, submitAttempt, definitelyNotCreated } from '../src/services/checkoutOrder.js'
import { buildConfirmedWhatsAppLink } from '../src/utils/whatsapp.js'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
test('quantities are aggregated safely and invalid/overflow quantities rejected', () => {
  assert.deepEqual(aggregateItems([{ productId: 'b', quantity: 2 }, { productId: 'a', quantity: 1 }, { productId: 'b', quantity: 3 }]), [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 5 }])
  for (const quantity of [0, -1, 1.2, Infinity, 2147483648]) assert.throws(() => aggregateItems([{ productId: 'a', quantity }]))
  assert.throws(() => aggregateItems([{ productId: 'a', quantity: 2147483647 }, { productId: 'a', quantity: 1 }]))
})
test('terminal orders cannot reopen and backwards/skipped transitions are rejected', () => {
  for (const terminal of ['CANCELLED', 'DELIVERED']) {
    for (const status of ORDER_STATUSES) assert.equal(canTransition(terminal, status), terminal === status)
  }
  assert.ok(canTransition('PENDING', 'PAID'))
  assert.ok(canTransition('CONFIRMED', 'SHIPPED'))
  assert.ok(!canTransition('PAID', 'PENDING'))
  assert.ok(!canTransition('PENDING', 'DELIVERED'))
  assert.ok(!canTransition('SHIPPED', 'CANCELLED'))
})
test('receipt capability is scoped to the guest order; only owner/admin can upload account orders', () => {
  const capability = 'a'.repeat(64)
  const guest = { userId: null, receiptTokenHash: hashSecret(capability) }
  assert.ok(receiptAllowed(guest, null, capability))
  assert.ok(!receiptAllowed({ ...guest, receiptTokenHash: hashSecret('b'.repeat(64)) }, null, capability))
  assert.ok(!receiptAllowed({ ...guest, userId: 'a' }, null, capability))
  assert.ok(!receiptAllowed({ userId: 'a' }, { id: 'b', role: 'CUSTOMER' }))
  assert.ok(receiptAllowed({ userId: 'a' }, { id: 'a', role: 'CUSTOMER' }))
  assert.ok(receiptAllowed({ userId: 'a' }, { id: 'b', role: 'ADMIN' }))
  assert.ok(!receiptAllowed({ userId: null, receiptTokenHash: null }, null, capability))
})
test('upload validates decoded size, canonical base64 and matching signatures', () => {
  assert.equal(validateUpload(png).mime, 'image/png')
  assert.throws(() => validateUpload(png.replace('image/png', 'image/jpeg')))
  for (const value of ['data:image/png;base64,%%%%', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/png;base64,aGVsbG8=', 'data:image/png;base64,AB==']) assert.throws(() => validateUpload(value))
  const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7\nQA\n%%EOF').toString('base64')
  assert.equal(validateUpload(pdf, { receipt: true }).mime, 'application/pdf')
  assert.throws(() => validateUpload(pdf))
  assert.throws(() => decodeDataUrl('data:image/png;base64,' + Buffer.alloc(IMAGE_MAX_BYTES + 1).toString('base64'), IMAGE_MAX_BYTES), error => error.status === 413)
  assert.throws(() => validateModel(png, 'fake.glb'))
  const chunk = Buffer.from('{"asset":{"version":"2.0"}}'.padEnd(28, ' '))
  const glb = Buffer.alloc(20 + chunk.length); glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8)
  glb.writeUInt32LE(chunk.length, 12); glb.write('JSON', 16); chunk.copy(glb, 20)
  assert.doesNotThrow(() => validateModel('data:application/octet-stream;base64,' + glb.toString('base64'), 'qa.glb'))
})
test('lost confirmation retains the same persisted attempt across reload and retries', async () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  const payload = { customer: { nombre: 'QA' }, delivery: {}, items: [{ productId: 'qa', quantity: 2 }] }
  const attempt = saveAttempt(storage, payload, 'guest', () => 'qa-attempt')
  payload.items[0].quantity = 9
  await assert.rejects(submitAttempt(attempt, async () => { throw new Error('lost response') }))
  const restored = loadAttempt(storage)
  assert.equal(restored.key, attempt.key)
  assert.equal(restored.payload.items[0].quantity, 2)
  const result = await submitAttempt(restored, async (data, _token, key) => {
    assert.equal(key, attempt.key); assert.equal(data.items[0].quantity, 2)
    return { id: 'confirmed', items: [], total: 29.90 }
  })
  assert.equal(result.id, 'confirmed')
  assert.ok(!definitelyNotCreated({ status: 500 }))
  assert.ok(!definitelyNotCreated({ status: 409, code: 'IDEMPOTENCY_CONFLICT' }))
  assert.ok(definitelyNotCreated({ status: 409 }))
  for (const status of [400, 401, 413, 429, 500]) assert.ok(!definitelyNotCreated({ status }, { retry: true }))
  assert.ok(definitelyNotCreated({ status: 409, code: 'ORDER_REJECTED' }, { retry: true }))
})
test('WhatsApp uses the confirmed order total/items/customer, never a cached cart', () => {
  const href = buildConfirmedWhatsAppLink({ id: 'qa-confirmed', customerNombre: 'Server name', customerCorreo: 'qa@example.invalid',
    deliveryType: 'PICKUP', total: 17.98, subtotal: 17.98, savings: 2, paymentMethodLabel: 'Server payment',
    items: [{ name: 'Server product', quantity: 2, unitPrice: 8.99 }] })
  const text = new URL(href).searchParams.get('text')
  for (const expected of ['qa-confirmed', 'Server name', '2x Server product', '17.98', 'Server payment', 'Punto de recojo']) assert.ok(text.includes(expected))
})
