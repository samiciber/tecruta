import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { serializeBrand, serializeStore, serializeNavItem, buildTree, pruneUnreachable } from '../lib/serializers.js'
import { normalizeHomeBanners, isBannerLive } from '../lib/navSchemas.js'
import { homeDefaults } from '../lib/homeDefaults.js'
import { homeLayoutSchema } from '../lib/homeSchemas.js'
import { resolveHome } from '../lib/homeResolver.js'
import { resolveFooter } from '../lib/footerContent.js'
import { legalDefaults } from '../lib/legalDefaults.js'

// Endpoints PÚBLICOS de contenido de la tienda. Se monta en /api, así que
// define: /nav, /brands, /popular-searches, /stores, /site-settings.
export const contentRouter = Router()

// Cache corto: el frontend revalida con TTL y el admin ve sus cambios en
// menos de un minuto sin recargar a mano.
const cacheShort = (res) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')

contentRouter.get('/footer', asyncHandler(async (req, res) => { cacheShort(res); res.json(resolveFooter(await loadSettings())) }))
contentRouter.get('/legal/:type', asyncHandler(async (req, res) => {
  if (!['terminos', 'privacidad'].includes(req.params.type)) return res.status(404).json({ error: 'Documento no encontrado.' })
  const settings = await loadSettings(); cacheShort(res)
  res.json((settings.legalPages ?? legalDefaults)[req.params.type])
}))

export async function loadSettings() {
  const rows = await prisma.siteSetting.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// GET /api/home: configuración resuelta y limitada a contenido publicable.
contentRouter.get(
  '/home',
  asyncHandler(async (req, res) => {
    const settings = await loadSettings()
    const parsed = homeLayoutSchema.safeParse(settings.homeLayout ?? homeDefaults)
    if (!parsed.success) throw new Error('La configuración de la Home almacenada no es válida.')
    const home = await resolveHome({ db: prisma, layout: parsed.data, settings })
    cacheShort(res)
    res.json(home)
  }),
)

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
    // Al público solo llegan los banners VIGENTES (activos y dentro de su ventana
    // de fechas), ya normalizados a la forma nueva (acepta datos guardados antes).
    if (settings.homeBanners !== undefined) {
      const now = new Date()
      settings.homeBanners = normalizeHomeBanners(settings.homeBanners).filter((b) => isBannerLive(b, now))
    }
    cacheShort(res)
    res.json(settings)
  }),
)
