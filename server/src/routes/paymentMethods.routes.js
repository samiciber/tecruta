import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'

export const paymentMethodsRouter = Router()

// GET /api/payment-methods
// Público: el checkout necesita saber qué métodos de pago están activos y
// con qué datos (número de Yape, cuenta bancaria, etc.) sin estar
// autenticado. Es la contraparte de solo-lectura de
// /api/admin/payment-methods (que sí requiere rol ADMIN y también
// devuelve los métodos inactivos, para poder reactivarlos).
paymentMethodsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const methods = await prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { key: 'asc' },
    })
    res.json(methods.map((m) => ({ key: m.key, label: m.label, config: m.config })))
  }),
)
