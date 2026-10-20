import { z } from 'zod'

// Plain text only, including store replies. Reject domain links, email links,
// protocols and markup rather than silently stripping user input.
export const noLinksOrHtml = value => !/[<>]|(?:https?:|mailto:|javascript:|data:|www\.)|(?:[\p{L}\d-]+\.)+[\p{L}]{2,63}(?:\b|\/)/iu.test(value)
const plain = max => z.string().trim().max(max).refine(noLinksOrHtml, 'Escribe texto sin enlaces ni HTML.')
export const reviewCreateSchema = z.object({
  orderItemId: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  title: plain(80).optional(),
  text: plain(1000).refine(value => value.length >= 10, 'Escribe entre 10 y 1000 caracteres.'),
}).strict()
export const reviewModerateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  rejectionReason: plain(500).optional(),
  storeReply: plain(1000).nullable().optional(),
}).strict().refine(value => value.status || value.storeReply !== undefined, 'Indica una acción.')
  .refine(value => value.status !== 'REJECTED' || value.rejectionReason?.length >= 5, 'Indica el motivo del rechazo (mínimo 5 caracteres).')

export const reviewQuerySchema = z.object({
  cursor: z.string().max(1500).optional(),
  sort: z.enum(['recent', 'helpful']).default('recent'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
})
