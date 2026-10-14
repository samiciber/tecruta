// Shared, dependency-free contract for the API and admin status selector.
export const ORDER_TRANSITIONS = Object.freeze({
  PENDING: ['CONFIRMED', 'PAID', 'CANCELLED'],
  CONFIRMED: ['PAID', 'SHIPPED', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
})
export const ORDER_STATUSES = Object.keys(ORDER_TRANSITIONS)
export function canTransition(from, to) {
  return ORDER_STATUSES.includes(to) && (from === to || ORDER_TRANSITIONS[from]?.includes(to))
}
