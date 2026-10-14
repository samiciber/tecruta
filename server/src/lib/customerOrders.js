import { serializeOrder } from './serializers.js'

// Only the authenticated owner's history needs this relation. Internal notes
// and receipt delivery URLs are never part of the customer response.
export const customerOrderInclude = {
  items: { include: { product: { select: { image: true, slug: true } } } },
  paymentMethod: true,
  statusHistory: {
    select: { id: true, status: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
}

export function serializeCustomerOrder(order) {
  const { receiptUrl: _receiptUrl, ...visible } = serializeOrder(order)
  return {
    ...visible,
    hasReceipt: Boolean(order.receiptUrl),
    statusHistory: (order.statusHistory || []).map(({ id, status, createdAt }) => ({ id, status, createdAt })),
  }
}
