import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { validate } from '../middleware/validate.js'
import { savedItemSchema, savedMergeSchema } from '../lib/navSchemas.js'

// Elementos guardados (lista de deseos). Solo clientes con sesión; los
// invitados usan localStorage y se fusionan al iniciar sesión (igual que el
// carrito). Devuelve solo ids: precio, stock e imagen se resuelven en vivo
// contra el catálogo en el frontend.
export const savedRouter = Router()
savedRouter.use(requireAuth)

const list = async (userId) => {
  const rows = await prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { productId: true } })
  return { productIds: rows.map((r) => r.productId) }
}

// GET /api/saved
savedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await list(req.user.id))
  }),
)

// POST /api/saved/items { productId } — idempotente
savedRouter.post(
  '/items',
  validate(savedItemSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.body.productId }, select: { id: true } })
    if (!product) return res.status(404).json({ error: 'Producto no encontrado.' })
    await prisma.savedItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId: product.id } },
      create: { userId: req.user.id, productId: product.id },
      update: {},
    })
    res.status(201).json(await list(req.user.id))
  }),
)

// DELETE /api/saved/items/:productId — idempotente
savedRouter.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    await prisma.savedItem.deleteMany({ where: { userId: req.user.id, productId: req.params.productId } })
    res.json(await list(req.user.id))
  }),
)

// POST /api/saved/merge { productIds } — une la lista del invitado con la de la cuenta
savedRouter.post(
  '/merge',
  validate(savedMergeSchema),
  asyncHandler(async (req, res) => {
    const unique = [...new Set(req.body.productIds)]
    const existing = await prisma.product.findMany({ where: { id: { in: unique } }, select: { id: true } })
    if (existing.length > 0) {
      await prisma.savedItem.createMany({
        data: existing.map((p) => ({ userId: req.user.id, productId: p.id })),
        skipDuplicates: true,
      })
    }
    res.json(await list(req.user.id))
  }),
)