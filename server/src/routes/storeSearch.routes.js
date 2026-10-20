import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { normalizeSearch } from '../../../src/utils/searchText.js'

export const suggestionLimit = rateLimit({ windowMs: 60000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Espera un momento antes de volver a buscar.' } })
const querySchema = z.object({ q: z.string().trim().max(80) })
export function categoryIsPublished(depth = 6) {
  return { visible: true, legacy: false, ...(depth ? { OR: [{ parentId: null }, { parent: categoryIsPublished(depth - 1) }] } : { parentId: null }) }
}
export function createStoreSearchRouter({ db = prisma } = {}) {
  const router = Router()
  router.get('/suggestions', suggestionLimit, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'La búsqueda admite hasta 80 caracteres.' })
    const q = normalizeSearch(parsed.data.q)
    if (q.length < 3) return res.json({ items: [] })
    const tokens = q.split(' ').filter(Boolean).slice(0, 8)
    const where = { AND: tokens.map(token => ({ searchText: { contains: token } })) }
    const [products, categories, brands] = await Promise.all([
      db.product.findMany({ where, take: 4, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true, image: true } }),
      db.category.findMany({ where: { ...where, ...categoryIsPublished() }, take: 2, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true, image: true } }),
      db.brand.findMany({ where: { ...where, visible: true }, take: 2, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true, logo: true } }),
    ])
    const rows = (items, prefix, kind, path) => items.map(row => ({ key: prefix + row.id, kind, label: row.name, image: row.image || row.logo || null, to: '/' + path + '/' + encodeURIComponent(row.slug) }))
    res.json({ items: [...rows(products, 'p-', 'Producto', 'producto'), ...rows(categories, 'c-', 'Categoría', 'categoria'), ...rows(brands, 'b-', 'Marca', 'marca')].slice(0, 8) })
  }))
  return router
}
export const storeSearchRouter = createStoreSearchRouter()
