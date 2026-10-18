import { z } from 'zod'
const id = z.string().trim().min(1).max(60)
const money = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/)
const text = z.string().trim().min(1).max(240)
const optionalText = z.string().trim().max(120).nullable().optional()
const key = { requestId: z.uuid().transform(value => value.toLowerCase()) }
export const paymentSchema = z.strictObject({
  method: z.enum(['cashOnDelivery', 'yape', 'plin', 'bankTransfer']), amount: money,
  received: money.optional(), reference: optionalText, verified: z.boolean().default(false),
})
export const saleSchema = z.strictObject({
  ...key, sessionId: id, orderId: id.optional(), mode: z.enum(['PENDING', 'CONFIRM']),
  customerName: optionalText, customerDocument: optionalText,
  discount: money.default('0.00'), discountReason: text.optional(),
  items: z.array(z.strictObject({ productId: id, quantity: z.number().int().min(1).max(1000000), expectedPrice: money })).max(100).default([]),
  payments: z.array(paymentSchema).max(4).default([]),
})
export const confirmSaleSchema = z.strictObject({ ...key, sessionId: id, payments: z.array(paymentSchema).max(4) })
export const openCashSchema = z.strictObject({ ...key, openingAmount: money })
export const cashEntrySchema = z.strictObject({ ...key, direction: z.enum(['IN', 'OUT']), amount: money, reason: text })
export const closeCashSchema = z.strictObject({ ...key, countedAmount: money, reason: text })
export const cancelSaleSchema = z.strictObject({ ...key, reason: text })
export const refundSchema = z.strictObject({
  ...key, sessionId: id, kind: z.enum(['RETURN', 'VOID']), reason: text,
  expectedAmount: money,
  method: z.enum(['cashOnDelivery', 'yape', 'plin', 'bankTransfer']), reference: optionalText,
  verified: z.literal(true),
  items: z.array(z.strictObject({ saleItemId: id, quantity: z.number().int().min(1).max(1000000), restock: z.boolean() })).min(1).max(100),
})
export const posSearchSchema = z.strictObject({ q: z.string().trim().min(2).max(128) })
export const reportSchema = z.strictObject({
  type: z.enum(['sales', 'payments', 'products', 'refunds', 'cash', 'low-stock']).default('sales'),
  from: z.iso.date().optional(), to: z.iso.date().optional(), userId: id.optional(), productId: id.optional(),
  method: z.enum(['cashOnDelivery', 'yape', 'plin', 'bankTransfer']).optional(),
})
