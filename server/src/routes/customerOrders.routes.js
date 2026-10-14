import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { customerOrderInclude, serializeCustomerOrder } from '../lib/customerOrders.js'
import { downloadReceipt } from '../lib/receiptDownload.js'

export function createCustomerOrdersRouter({ db = prisma, readReceipt = downloadReceipt } = {}) {
  const router = Router()
  // No role bypass: ADMIN can read only its own orders through these endpoints.
  router.use('/me', (_req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache' })
    next()
  }, requireAuth)
  router.get('/me', asyncHandler(async (req, res) => {
    const orders = await db.order.findMany({
      where: { userId: req.user.id }, include: customerOrderInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    res.json(orders.map(serializeCustomerOrder))
  }))
  router.get('/me/:orderId/receipt', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiadas consultas de comprobantes. Inténtalo más tarde.' },
  }), asyncHandler(async (req, res) => {
    const order = await db.order.findFirst({
      where: { id: req.params.orderId, userId: req.user.id },
      select: { id: true, receiptUrl: true },
    })
    // Same response for other owners, guest orders, missing IDs or no receipt.
    if (!order?.receiptUrl) return res.status(404).json({ error: 'Comprobante no encontrado.' })
    const { bytes, type, extension } = await readReceipt(order.receiptUrl)
    res.set({
      'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="comprobante.${extension}"`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
    })
    res.send(bytes)
  }))
  return router
}

export const customerOrdersRouter = createCustomerOrdersRouter()
