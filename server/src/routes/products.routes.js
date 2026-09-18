import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeProduct } from '../lib/serializers.js'
import { asyncHandler } from '../middleware/errorHandler.js'

export const productsRouter = Router()

const includeRelations = { category: true, images: true }

// GET /api/products
// Query params opcionales: ?category=power-banks  ?q=cargador  ?featured=true
productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, q, featured } = req.query

    const where = {}
    if (category) where.category = { slug: category }
    if (featured === 'true') where.featured = true
    if (q) where.name = { contains: String(q), mode: 'insensitive' }

    const products = await prisma.product.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    })

    res.json(products.map(serializeProduct))
  }),
)

// GET /api/products/:slug
productsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: includeRelations,
    })

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }

    res.json(serializeProduct(product))
  }),
)