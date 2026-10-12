import { createHash, timingSafeEqual } from 'node:crypto'
export { ORDER_TRANSITIONS, ORDER_STATUSES, canTransition } from '../../../src/utils/orderStatus.js'
export class OrderError extends Error {
  constructor(status, message, productId) {
    super(message)
    this.status = status
    this.productId = productId
  }
}
export function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex')
}
export function receiptAllowed(order, user, token) {
  if (user?.role === 'ADMIN' || (order.userId && order.userId === user?.id)) return true
  if (order.userId || !order.receiptTokenHash || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false
  const expected = Buffer.from(order.receiptTokenHash, 'hex')
  const actual = Buffer.from(hashSecret(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
export function aggregateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 200) {
    throw new OrderError(400, 'El pedido debe tener entre 1 y 200 líneas.')
  }
  const grouped = new Map()
  for (const { productId, quantity } of items) {
    const total = (grouped.get(productId) || 0) + quantity
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(total) || total > 2147483647) {
      throw new OrderError(400, 'La cantidad debe ser un entero positivo válido.', productId)
    }
    grouped.set(productId, total)
  }
  // Same lock order for creation/cancellation to avoid product deadlocks.
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([productId, quantity]) => ({ productId, quantity }))
}
