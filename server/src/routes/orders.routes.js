import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { serializeOrder } from '../lib/serializers.js'
import { validate } from '../middleware/validate.js'
import { createOrderSchema } from '../lib/schemas.js'
import { uploadReceiptToCloudinary } from '../lib/cloudinary.js'
import { createOrder, orderInclude } from '../lib/orderService.js'
import { OrderError, receiptAllowed } from '../lib/orderPolicy.js'
import { validateUpload } from '../lib/uploadValidation.js'
import { receiptJson } from '../middleware/bodyLimits.js'
import { createOrderLimit, receiptLimit } from '../middleware/orderLimits.js'

// A supplied session must validate; never downgrade a signed-in checkout to guest.
function authIfPresent(req, res, next) {
  return req.headers.authorization ? requireAuth(req, res, next) : next()
}

export function createOrdersRouter({ db = prisma, uploadReceipt = uploadReceiptToCloudinary } = {}) {
  const router = Router()
  router.post('/', createOrderLimit, authIfPresent, validate(createOrderSchema), asyncHandler(async (req, res) => {
    const result = await createOrder(db, req.body, req.user, req.get('Idempotency-Key'), process.env.JWT_SECRET)
    res.status(result.replayed ? 200 : 201).json({
      ...serializeOrder(result.order),
      ...(result.receiptToken ? { receiptToken: result.receiptToken } : {}),
    })
  }))

  // Authorize before reading a potentially large body or uploading a file.
  router.post('/:orderId/receipt', receiptLimit, authIfPresent, asyncHandler(async (req, _res, next) => {
    const token = req.get('X-Receipt-Token')
    if (!req.user && !token) throw new OrderError(401, 'Debes identificarte para adjuntar el comprobante.')
    const order = await db.order.findUnique({ where: { id: req.params.orderId },
      select: { id: true, userId: true, receiptTokenHash: true } })
    if (!order) throw new OrderError(404, 'Pedido no encontrado.')
    if (!receiptAllowed(order, req.user, token)) throw new OrderError(req.user ? 403 : 401, 'No tienes permiso para adjuntar este comprobante.')
    next()
  }), receiptJson, asyncHandler(async (req, res) => {
    validateUpload(req.body?.file, { receipt: true })
    const receiptUrl = await uploadReceipt(req.body.file)
    await db.order.update({ where: { id: req.params.orderId }, data: { receiptUrl } })
    res.json({ ok: true, receiptUrl })
  }))

  router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const orders = await db.order.findMany({ where: { userId: req.user.id }, include: orderInclude, orderBy: { createdAt: 'desc' } })
    res.json(orders.map(serializeOrder))
  }))
  return router
}
export const ordersRouter = createOrdersRouter()
