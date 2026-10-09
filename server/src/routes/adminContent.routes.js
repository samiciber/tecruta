import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { guard, httpError } from '../lib/prismaErrors.js'
import { slugify } from '../lib/slug.js'
import {
  serializeBrand,
  serializeStore,
  serializeTile,
  serializeCategoryNode,
} from '../lib/serializers.js'
import {
  brandCreateSchema,
  brandUpdateSchema,
  popularSearchCreateSchema,
  popularSearchUpdateSchema,
  storeCreateSchema,
  storeUpdateSchema,
  SITE_SETTING_SCHEMAS,
  navItemCreateSchema,
  navItemUpdateSchema,
  navReorderSchema,
  categoryNodeCreateSchema,
  categoryNodeUpdateSchema,
  tileCreateSchema,
  tileUpdateSchema,
  assignProductsSchema,
  NAV_MENU_KEYS,
  normalizeHomeBanners,
} from '../lib/navSchemas.js'

// Endpoints de administración de contenido (marcas, navegación, categorías
// en árbol, tiendas, búsquedas populares, ajustes, asignación de productos).
// Se monta en /api/admin. Todos con zod + asyncHandler + sesión ADMIN.
export const adminContentRouter = Router()
adminContentRouter.use(requireAuth, requireRole('ADMIN'))

const orNull = (v) => (v === '' ? null : v)

// =======================================================================
// Marcas
// =======================================================================

adminContentRouter.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(brands.map(serializeBrand))
  }),
)

adminContentRouter.post(
  '/brands',
  validate(brandCreateSchema),
  asyncHandler(async (req, res) => {
    const { name, slug, logo, featured, featuredPosition, visible } = req.body
    const brand = await guard(
      () =>
        prisma.brand.create({
          data: {
            name,
            slug: slug || slugify(name),
            logo: orNull(logo) ?? null,
            featured: featured ?? false,
            featuredPosition: featuredPosition ?? 0,
            visible: visible ?? true,
          },
        }),
      'Ya existe una marca con ese slug.',
    )
    res.status(201).json(serializeBrand(brand))
  }),
)

adminContentRouter.patch(
  '/brands/:id',
  validate(brandUpdateSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body }
    if ('logo' in data) data.logo = orNull(data.logo) ?? null
    const brand = await guard(
      () => prisma.brand.update({ where: { id: req.params.id }, data, include: { _count: { select: { products: true } } } }),
      'Ya existe una marca con ese slug.',
    )
    res.json(serializeBrand(brand))
  }),
)

adminContentRouter.delete(
  '/brands/:id',
  asyncHandler(async (req, res) => {
    const count = await prisma.product.count({ where: { brandId: req.params.id } })
    if (count > 0) {
      throw httpError(409, `No se puede eliminar: la marca tiene ${count} producto(s) asignado(s). Reasígnalos o ocúltala.`)
    }
    await guard(() => prisma.brand.delete({ where: { id: req.params.id } }))
    res.status(204).end()
  }),
)

// =======================================================================
// Búsquedas populares
// =======================================================================

adminContentRouter.get(
  '/popular-searches',
  asyncHandler(async (req, res) => {
    res.json(await prisma.popularSearch.findMany({ orderBy: [{ position: 'asc' }, { text: 'asc' }] }))
  }),
)

adminContentRouter.post(
  '/popular-searches',
  validate(popularSearchCreateSchema),
  asyncHandler(async (req, res) => {
    const last = await prisma.popularSearch.aggregate({ _max: { position: true } })
    const row = await prisma.popularSearch.create({
      data: {
        text: req.body.text,
        position: req.body.position ?? (last._max.position ?? -1) + 1,
        active: req.body.active ?? true,
      },
    })
    res.status(201).json(row)
  }),
)

adminContentRouter.patch(
  '/popular-searches/:id',
  validate(popularSearchUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await guard(() => prisma.popularSearch.update({ where: { id: req.params.id }, data: req.body })))
  }),
)

adminContentRouter.delete(
  '/popular-searches/:id',
  asyncHandler(async (req, res) => {
    await guard(() => prisma.popularSearch.delete({ where: { id: req.params.id } }))
    res.status(204).end()
  }),
)

// =======================================================================
// Tiendas (solo una puede ser predeterminada)
// =======================================================================

adminContentRouter.get(
  '/stores',
  asyncHandler(async (req, res) => {
    const rows = await prisma.store.findMany({ orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }] })
    res.json(rows.map(serializeStore))
  }),
)

adminContentRouter.post(
  '/stores',
  validate(storeCreateSchema),
  asyncHandler(async (req, res) => {
    const store = await prisma.$transaction(async (tx) => {
      const makeDefault = req.body.isDefault === true
      if (makeDefault) await tx.store.updateMany({ data: { isDefault: false } })
      return tx.store.create({ data: { ...req.body, isDefault: makeDefault } })
    })
    res.status(201).json(serializeStore(store))
  }),
)

adminContentRouter.patch(
  '/stores/:id',
  validate(storeUpdateSchema),
  asyncHandler(async (req, res) => {
    const store = await guard(() =>
      prisma.$transaction(async (tx) => {
        if (req.body.isDefault === true) {
          await tx.store.updateMany({ where: { id: { not: req.params.id } }, data: { isDefault: false } })
        }
        return tx.store.update({ where: { id: req.params.id }, data: req.body })
      }),
    )
    res.json(serializeStore(store))
  }),
)

adminContentRouter.delete(
  '/stores/:id',
  asyncHandler(async (req, res) => {
    await guard(() => prisma.store.delete({ where: { id: req.params.id } }))
    res.status(204).end()
  }),
)

// =======================================================================
// Ajustes del sitio (clave → JSON validado con su propio schema)
// =======================================================================

adminContentRouter.get(
  '/site-settings',
  asyncHandler(async (req, res) => {
    const rows = await prisma.siteSetting.findMany()
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    // El editor siempre recibe la forma nueva de los banners (incluso si se guardaron antes).
    if (settings.homeBanners !== undefined) settings.homeBanners = normalizeHomeBanners(settings.homeBanners)
    res.json(settings)
  }),
)

adminContentRouter.put(
  '/site-settings/:key',
  asyncHandler(async (req, res) => {
    const schema = SITE_SETTING_SCHEMAS[req.params.key]
    if (!schema) throw httpError(404, `Ajuste desconocido: "${req.params.key}".`)
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      return res.status(400).json({ error: issues[0] ? `${issues[0].path}: ${issues[0].message}` : 'Datos inválidos.', issues })
    }
    const row = await prisma.siteSetting.upsert({
      where: { key: req.params.key },
      update: { value: parsed.data },
      create: { key: req.params.key, value: parsed.data },
    })
    res.json({ [row.key]: row.value })
  }),
)

// =======================================================================
// Ítems de navegación (menús Acuerdos / Soporte / Descubre / Más / quick)
// =======================================================================

// Un padre debe ser SUBMENU del mismo menú y de primer nivel (1 subnivel).
async function assertValidNavParent(parentId, menuKey) {
  if (!parentId) return
  const parent = await prisma.navItem.findUnique({ where: { id: parentId } })
  if (!parent) throw httpError(400, 'El ítem padre no existe.')
  if (parent.type !== 'SUBMENU') throw httpError(400, 'El padre debe ser un ítem de tipo SUBMENU.')
  if (parent.parentId) throw httpError(400, 'Solo se permite un nivel de subitems.')
  if (menuKey && parent.menuKey !== menuKey) throw httpError(400, 'El padre pertenece a otro menú.')
}

adminContentRouter.get(
  '/nav-items',
  asyncHandler(async (req, res) => {
    const where = {}
    if (req.query.menu) {
      if (!NAV_MENU_KEYS.includes(String(req.query.menu))) throw httpError(400, `menu debe ser uno de: ${NAV_MENU_KEYS.join(', ')}.`)
      where.menuKey = String(req.query.menu)
    }
    // Lista plana (con parentId); el editor del admin arma la jerarquía.
    res.json(await prisma.navItem.findMany({ where, orderBy: [{ menuKey: 'asc' }, { position: 'asc' }, { label: 'asc' }] }))
  }),
)

adminContentRouter.post(
  '/nav-items',
  validate(navItemCreateSchema),
  asyncHandler(async (req, res) => {
    const { menuKey, parentId, type, label, href, position, visible } = req.body
    await assertValidNavParent(parentId, menuKey)
    const last = await prisma.navItem.aggregate({ where: { menuKey, parentId: parentId ?? null }, _max: { position: true } })
    const item = await prisma.navItem.create({
      data: {
        menuKey,
        parentId: parentId ?? null,
        type: type ?? 'LINK',
        label: label ?? '',
        href: orNull(href) ?? null,
        position: position ?? (last._max.position ?? -1) + 1,
        visible: visible ?? true,
      },
    })
    res.status(201).json(item)
  }),
)

// Reordenar en bloque (arrastrar y soltar). Declarada ANTES de '/:id'.
adminContentRouter.put(
  '/nav-items/reorder',
  validate(navReorderSchema),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(
      req.body.items.map((it) =>
        prisma.navItem.update({
          where: { id: it.id },
          data: { position: it.position, ...(it.parentId !== undefined ? { parentId: it.parentId } : {}) },
        }),
      ),
    )
    res.json({ ok: true })
  }),
)

adminContentRouter.patch(
  '/nav-items/:id',
  validate(navItemUpdateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.navItem.findUnique({ where: { id: req.params.id } })
    if (!existing) throw httpError(404, 'Ítem no encontrado.')
    const data = { ...req.body }
    if ('href' in data) data.href = orNull(data.href) ?? null
    if ('parentId' in data && data.parentId) {
      if (data.parentId === existing.id) throw httpError(400, 'Un ítem no puede ser su propio padre.')
      await assertValidNavParent(data.parentId, data.menuKey ?? existing.menuKey)
    }
    res.json(await prisma.navItem.update({ where: { id: existing.id }, data }))
  }),
)

adminContentRouter.delete(
  '/nav-items/:id',
  asyncHandler(async (req, res) => {
    // Los hijos de un SUBMENU se eliminan en cascada (onDelete: Cascade).
    await guard(() => prisma.navItem.delete({ where: { id: req.params.id } }))
    res.status(204).end()
  }),
)

// =======================================================================
// Categorías en árbol (incluye ocultas y heredadas) + tiles de referencia
// Prefijo /category-tree para no chocar con /categories (legado, sin zod).
// =======================================================================

adminContentRouter.get(
  '/category-tree',
  asyncHandler(async (req, res) => {
    const rows = await prisma.category.findMany({
      include: { _count: { select: { products: true, children: true } } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    })
    res.json(rows.map((r) => ({ ...serializeCategoryNode(r), childCount: r._count.children })))
  }),
)

// Evita ciclos: el nuevo padre no puede ser el propio nodo ni un descendiente.
async function assertNoCycle(nodeId, newParentId) {
  let cursor = newParentId
  for (let i = 0; cursor && i < 20; i++) {
    if (cursor === nodeId) throw httpError(400, 'No puedes mover una categoría dentro de sí misma o de sus descendientes.')
    const row = await prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } })
    cursor = row?.parentId ?? null
  }
}

adminContentRouter.post(
  '/category-tree',
  validate(categoryNodeCreateSchema),
  asyncHandler(async (req, res) => {
    const { name, slug, parentId, description, icon, image, position, visible, legacy } = req.body
    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId } })
      if (!parent) throw httpError(400, 'La categoría padre no existe.')
    }
    const last = await prisma.category.aggregate({ where: { parentId: parentId ?? null }, _max: { position: true } })
    const row = await guard(
      () =>
        prisma.category.create({
          data: {
            name,
            slug: slug || slugify(name),
            parentId: parentId ?? null,
            description: description ?? null,
            icon: icon ?? null,
            image: orNull(image) ?? null,
            position: position ?? (last._max.position ?? -1) + 1,
            visible: visible ?? true,
            legacy: legacy ?? false,
          },
        }),
      'Ya existe una categoría con ese slug.',
    )
    res.status(201).json(serializeCategoryNode(row))
  }),
)

adminContentRouter.patch(
  '/category-tree/:id',
  validate(categoryNodeUpdateSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body }
    if ('image' in data) data.image = orNull(data.image) ?? null
    if ('parentId' in data && data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } })
      if (!parent) throw httpError(400, 'La categoría padre no existe.')
      await assertNoCycle(req.params.id, data.parentId)
    }
    const row = await guard(
      () => prisma.category.update({ where: { id: req.params.id }, data }),
      'Ya existe una categoría con ese slug.',
    )
    res.json(serializeCategoryNode(row))
  }),
)

adminContentRouter.delete(
  '/category-tree/:id',
  asyncHandler(async (req, res) => {
    const [children, products] = await Promise.all([
      prisma.category.count({ where: { parentId: req.params.id } }),
      prisma.product.count({ where: { categoryId: req.params.id } }),
    ])
    if (children > 0) throw httpError(409, `No se puede eliminar: tiene ${children} subcategoría(s).`)
    if (products > 0) throw httpError(409, `No se puede eliminar: tiene ${products} producto(s) asignado(s). Reasígnalos primero.`)
    await guard(() => prisma.category.delete({ where: { id: req.params.id } }))
    res.status(204).end()
  }),
)

adminContentRouter.get(
  '/category-tree/:id/tiles',
  asyncHandler(async (req, res) => {
    const tiles = await prisma.categoryTile.findMany({ where: { categoryId: req.params.id }, orderBy: { position: 'asc' } })
    res.json(tiles.map(serializeTile))
  }),
)

adminContentRouter.post(
  '/category-tree/:id/tiles',
  validate(tileCreateSchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } })
    if (!category) throw httpError(404, 'Categoría no encontrada.')
    const last = await prisma.categoryTile.aggregate({ where: { categoryId: category.id }, _max: { position: true } })
    const tile = await prisma.categoryTile.create({
      data: {
        categoryId: category.id,
        title: req.body.title,
        image: orNull(req.body.image) ?? null,
        href: orNull(req.body.href) ?? null,
        position: req.body.position ?? (last._max.position ?? -1) + 1,
        visible: req.body.visible ?? true,
      },
    })
    res.status(201).json(serializeTile(tile))
  }),
)

adminContentRouter.patch(
  '/category-tiles/:tileId',
  validate(tileUpdateSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body }
    if ('image' in data) data.image = orNull(data.image) ?? null
    if ('href' in data) data.href = orNull(data.href) ?? null
    res.json(serializeTile(await guard(() => prisma.categoryTile.update({ where: { id: req.params.tileId }, data }))))
  }),
)

adminContentRouter.delete(
  '/category-tiles/:tileId',
  asyncHandler(async (req, res) => {
    await guard(() => prisma.categoryTile.delete({ where: { id: req.params.tileId } }))
    res.status(204).end()
  }),
)

// =======================================================================
// Asignación (masiva) de productos a categoría y/o marca
// POST /api/admin/products/assign { productIds, categoryId?, brandId? }
// =======================================================================

adminContentRouter.post(
  '/products/assign',
  validate(assignProductsSchema),
  asyncHandler(async (req, res) => {
    const { productIds, categoryId, brandId } = req.body
    const data = {}
    if (categoryId !== undefined) {
      const c = await prisma.category.findUnique({ where: { id: categoryId } })
      if (!c) throw httpError(400, 'La categoría no existe.')
      data.categoryId = categoryId
    }
    if (brandId !== undefined) {
      if (brandId !== null) {
        const b = await prisma.brand.findUnique({ where: { id: brandId } })
        if (!b) throw httpError(400, 'La marca no existe.')
      }
      data.brandId = brandId
    }
    const result = await prisma.product.updateMany({ where: { id: { in: productIds } }, data })
    res.json({ updated: result.count, requested: productIds.length })
  }),
)

// =======================================================================
// Resumen del panel (pedidos pendientes, stock bajo, catálogo por ordenar)
// GET /api/admin/dashboard
// =======================================================================

const LOW_STOCK_THRESHOLD = 5

adminContentRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const [byStatus, orders7, revenue30, lowStockList, lowStockCount, outOfStock, noBrand, inLegacy, customers, recent] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.count({ where: { createdAt: { gte: since7 } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: since30 }, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } } }),
      prisma.product.findMany({ where: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } }, orderBy: { stock: 'asc' }, take: 8, select: { id: true, name: true, slug: true, stock: true } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { brandId: null } }),
      prisma.product.count({ where: { category: { legacy: true } } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, customerNombre: true, customerApellido: true, total: true, status: true, createdAt: true } }),
    ])
    const status = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]))
    res.json({
      orders: { pending: status.PENDING ?? 0, confirmed: status.CONFIRMED ?? 0, byStatus: status, last7Days: orders7 },
      revenue30Days: Number(revenue30._sum.total ?? 0),
      stock: { threshold: LOW_STOCK_THRESHOLD, low: lowStockCount, out: outOfStock, lowList: lowStockList },
      catalog: { withoutBrand: noBrand, inLegacyCategories: inLegacy },
      customers,
      recentOrders: recent.map((o) => ({ id: o.id, customer: `${o.customerNombre} ${o.customerApellido}`.trim(), total: Number(o.total), status: o.status, createdAt: o.createdAt })),
    })
  }),
)