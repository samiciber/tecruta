import { rateLimit } from 'express-rate-limit'

export function makeOrderLimit(limit, message) {
  return rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: message } })
}
export const createOrderLimit = makeOrderLimit(20, 'Demasiados intentos de pedido. Espera unos minutos y vuelve a intentarlo.')
export const receiptLimit = makeOrderLimit(30, 'Demasiados intentos de comprobante. Espera unos minutos y vuelve a intentarlo.')
