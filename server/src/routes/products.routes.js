import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeProduct, serializeProductCard, productCardSelect } from '../lib/serializers.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { normalizeSearch } from '../../../src/utils/searchText.js'

export const productsRouter = Router()

const includeRelations = { category: true, images: true, brandRef: true }

// GET /api/products
// Query params opcionales: ?category=power-banks  ?brand=ugreen  ?q=cargador  ?featured=true
productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, brand, q, featured } = req.query

    const where = {}
    if (category) {
      // Incluye los productos de las subcategorías (la página /categoria/:slug
      // de un nodo con hijos muestra los de toda su rama).
      const root = await prisma.category.findUnique({ where: { slug: String(category) }, select: { id: true } })
      if (root) {
        const ids = [root.id]
        let frontier = [root.id]
        for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
          const kids = await prisma.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } })
          frontier = kids.map((k) => k.id)
          ids.push(...frontier)
        }
        where.categoryId = { in: ids }
      } else {
        where.category = { slug: String(category) }
      }
    }
    if (brand) where.brandRef = { slug: String(brand) }
    if (featured === 'true') where.featured = true
    if (q) {
      if (typeof q !== 'string' || q.length > 80) return res.status(400).json({ error: 'La búsqueda admite hasta 80 caracteres.' })
      where.AND = normalizeSearch(q).split(' ').filter(Boolean).slice(0, 8).map(token => ({ searchText: { contains: token } }))
    }

    const cards = req.query.view === 'cards'
    const products = await prisma.product.findMany({
      where,
      ...(cards ? { select: productCardSelect } : { include: includeRelations }),
      orderBy: { createdAt: 'desc' },
    })

    res.json(products.map(cards ? serializeProductCard : serializeProduct))
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
