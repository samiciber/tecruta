import { z } from 'zod'

const id = z.string().trim().min(1).max(60)
const optionalText = max => z.string().trim().max(max).transform(value => value || null).nullable().optional()
export const inventoryLookupSchema = z.strictObject({
  code: z.string().trim().min(1).max(128).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
})

export const inventoryBarcodeSchema = z.strictObject({
  code: z.string().trim().min(1).max(128).refine(value => !/[\u0000-\u001f\u007f]/.test(value), 'El código contiene caracteres de control.'),
  kind: z.enum(['MANUFACTURER', 'INTERNAL']),
}).refine(value => value.kind !== 'INTERNAL' || /^TR-[A-Za-z0-9._-]{1,36}$/.test(value.code), {
  message: 'Los códigos internos deben comenzar por TR- y usar hasta 39 caracteres ASCII.', path: ['code'],
})

export const inventoryDraftSchema = z.strictObject({
  requestId: z.uuid(),
  productId: id,
  type: z.enum(['PURCHASE', 'CUSTOMER_RETURN', 'POSITIVE_ADJUSTMENT', 'LOSS', 'DAMAGE', 'SUPPLIER_RETURN', 'NEGATIVE_ADJUSTMENT']),
  quantity: z.number().int().min(1).max(2147483647),
  reason: z.string().trim().min(1).max(240),
  reference: optionalText(120),
  supplier: optionalText(120),
  unitCost: z.number().min(0).max(99999999.99).multipleOf(0.01).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
})

export const inventoryMovementFiltersSchema = z.strictObject({
  productId: id.optional(),
  type: z.enum(['INITIAL_BALANCE', 'PURCHASE', 'CUSTOMER_RETURN', 'POSITIVE_ADJUSTMENT', 'LOSS', 'DAMAGE', 'SUPPLIER_RETURN', 'NEGATIVE_ADJUSTMENT', 'WEB_ORDER', 'WEB_CANCELLATION', 'POS_SALE', 'POS_RETURN', 'REVERSAL']).optional(),
  userId: id.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export const inventoryProductSearchSchema = z.strictObject({
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const inventoryReversalSchema = z.strictObject({
  reason: z.string().trim().min(1).max(240),
})
