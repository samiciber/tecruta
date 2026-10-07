import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { serializeBrand, serializeStore, serializeNavItem, buildTree, pruneUnreachable } from '../lib/serializers.js'

// Endpoints PÚBLICOS de contenido de la tienda. Se monta en /api, así que
// define: /nav, /brands, /popular-searches, /stores, /site-settings.
export const contentRouter = Router()

// Cache corto: el frontend revalida con TTL y el admin ve sus cambios en
// menos de un minuto sin recargar a mano.
const cacheShort = (res) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')

export async function loadSettings() {
  const rows = await prisma.siteSetting.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// GET /api/nav → { menus: { acuerdos, soporte, descubre, mas, quick }, seasonalPromo }
contentRouter.get(
  '/nav',
  asyncHandler(async (req, res) => {
    const [rows, settings] = await Promise.all([
      prisma.navItem.findMany({ where: { visible: true }, orderBy: [{ position: 'asc' }, { label: 'asc' }] }),
      loadSettings(),
    ])
    const promo = settings.seasonalPromo ?? null
    const menus = { acuerdos: [], soporte: [], descubre: [], mas: [], quick: [] }

    // Un submenú oculto oculta también sus ítems.
    for (const root of buildTree(pruneUnreachable(rows))) {
      const item = serializeNavItem(root, promo)
      if (item && menus[root.menuKey]) menus[root.menuKey].push(item)
    }
    cacheShort(res)
    res.json({ menus, seasonalPromo: promo })
  }),
)

// GET /api/brands → { featured: [...], all: [...] } (solo visibles).
// `all` va ordenada A–Z; cada marca incluye productCount para el estado
// vacío "Aún no tenemos productos de esta marca".
contentRouter.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany({
      where: { visible: true },
      include: { _count: { select: { products: true } } },
    })
    const featured = brands
      .filter((b) => b.featured)
      .sort((a, b) => a.featuredPosition - b.featuredPosition || a.name.localeCompare(b.name))
    const all = brands.slice().sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    cacheShort(res)
    res.json({ featured: featured.map(serializeBrand), all: all.map(serializeBrand) })
  }),
)

// GET /api/popular-searches
contentRouter.get(
  '/popular-searches',
  asyncHandler(async (req, res) => {
    const rows = await prisma.popularSearch.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { text: 'asc' }],
    })
    cacheShort(res)
    res.json(rows.map((r) => ({ id: r.id, text: r.text })))
  }),
)

// GET /api/stores → tiendas activas, la predeterminada primero.
contentRouter.get(
  '/stores',
  asyncHandler(async (req, res) => {
    const rows = await prisma.store.findMany({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    })
    cacheShort(res)
    res.json(rows.map(serializeStore))
  }),
)

// GET /api/site-settings → { seasonalPromo: {...}, ... }
contentRouter.get(
  '/site-settings',
  asyncHandler(async (req, res) => {
    const settings = await loadSettings()
    // Al público solo llegan los banners activos.
    if (Array.isArray(settings.homeBanners)) settings.homeBanners = settings.homeBanners.filter((b) => b.active)
    cacheShort(res)
    res.json(settings)
  }),
)