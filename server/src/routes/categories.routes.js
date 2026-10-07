import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeCategory, serializeCategoryNode, serializeTile, buildTree, pruneUnreachable } from '../lib/serializers.js'
import { asyncHandler } from '../middleware/errorHandler.js'

export const categoriesRouter = Router()

const cacheShort = (res) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')

// GET /api/categories
// COMPATIBILIDAD: devuelve solo las categorías heredadas (legacy), que son
// las que hoy consume el frontend. En el Bloque 3 el frontend pasa a usar
// /api/categories/tree y este endpoint se mantiene sin cambios.
categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({ where: { legacy: true }, orderBy: { name: 'asc' } })
    res.json(categories.map(serializeCategory))
  }),
)

// GET /api/categories/tree
// Árbol de categorías visibles (sin heredadas), listo para el menú:
// [{ id, slug, name, ..., children: [...] }]. Un nodo oculto oculta su rama.
categoriesRouter.get(
  '/tree',
  asyncHandler(async (req, res) => {
    const rows = await prisma.category.findMany({
      where: { legacy: false, visible: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    })
    // Si un ancestro está oculto, toda su rama se descarta.
    cacheShort(res)
    res.json(buildTree(pruneUnreachable(rows.map(serializeCategoryNode))))
  }),
)

// GET /api/categories/:slug
// Detalle para la página de categoría: nodo, migas de pan, hijos directos
// y tiles de referencia visibles.
categoriesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const node = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: {
        tiles: { where: { visible: true }, orderBy: { position: 'asc' } },
        children: { where: { visible: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] },
      },
    })
    if (!node || node.legacy || !node.visible) {
      return res.status(404).json({ error: 'Categoría no encontrada.' })
    }

    const breadcrumb = []
    let cursor = node
    for (let i = 0; i < 6 && cursor?.parentId; i++) {
      cursor = await prisma.category.findUnique({ where: { id: cursor.parentId } })
      if (cursor) breadcrumb.unshift({ slug: cursor.slug, name: cursor.name })
    }

    cacheShort(res)
    res.json({
      ...serializeCategoryNode(node),
      breadcrumb,
      children: node.children.map(serializeCategoryNode),
      tiles: node.tiles.map(serializeTile),
    })
  }),
)