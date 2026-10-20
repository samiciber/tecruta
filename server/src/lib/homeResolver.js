import { serializeProduct } from './serializers.js'
import { isBannerLive, normalizeHomeBanners } from './navSchemas.js'
import { resolveAdditionalSection } from './homeSectionsResolver.js'

const PRODUCT_INCLUDE = { category: true, images: true, brandRef: true }
const futureDates = (values, now) => values
  .filter((value) => value && new Date(value) > now)
  .map((value) => new Date(value))

function buildCategoryTree(rows) {
  const nodes = new Map(rows.map((row) => [row.id, { ...row, children: [] }]))
  const roots = []
  for (const row of rows) {
    const node = nodes.get(row.id)
    if (row.parentId && nodes.has(row.parentId)) nodes.get(row.parentId).children.push(node)
    else if (!row.parentId) roots.push(node)
  }
  const countBranch = (node) => {
    node.branchProductCount = node.productCount + node.children.reduce((sum, child) => sum + countBranch(child), 0)
    return node.branchProductCount
  }
  roots.forEach(countBranch)
  return roots
}

function circleItems(config, tree) {
  const cfg = config && typeof config === 'object' ? config : {}
  const selected = Array.isArray(cfg.items)
    ? cfg.items
    : tree.map((node) => ({ id: `cat-${node.id}`, type: 'category', categoryId: node.id, visible: true }))
  const byId = new Map()
  const flatten = (nodes) => nodes.forEach((node) => { byId.set(node.id, node); flatten(node.children) })
  flatten(tree)
  const items = []
  for (const item of selected) {
    if (item.visible === false) continue
    if (item.type === 'custom') {
      items.push({ key: item.id, label: item.label, to: item.href, image: item.image || null, external: /^https?:\/\//.test(item.href || '') })
      continue
    }
    const node = byId.get(item.categoryId)
    if (!node || (cfg.onlyWithProducts !== false && node.branchProductCount === 0)) continue
    items.push({
      key: item.id,
      label: item.label?.trim() || node.name,
      to: `/categoria/${node.slug}`,
      image: item.image || node.image || null,
      external: false,
    })
  }
  return { title: cfg.title || 'Compra por categoría', items: cfg.max ? items.slice(0, cfg.max) : items }
}

async function categoryIds(db, slugValue) {
  const root = await db.category.findUnique({
    where: { slug: slugValue },
    select: { id: true, visible: true, legacy: true },
  })
  if (!root || !root.visible || root.legacy) return []
  const ids = [root.id]
  let frontier = [root.id]
  for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
    const children = await db.category.findMany({
      where: { parentId: { in: frontier }, visible: true, legacy: false },
      select: { id: true },
    })
    frontier = children.map((row) => row.id)
    ids.push(...frontier)
  }
  return ids
}

async function findSourceProducts(db, source, limit) {
  const where = {}
  if (source.kind === 'manual') {
    if (!source.productIds?.length) return []
    where.id = { in: source.productIds.slice(0, limit) }
  }
  if (source.kind === 'featured') where.featured = true
  if (source.kind === 'bestSeller') where.bestSeller = true
  if (source.kind === 'discount') where.compareAtPrice = { gt: db.product.fields.price }
  if (source.kind === 'brand') where.brandRef = { slug: source.slug, visible: true }
  if (source.kind === 'category') {
    const ids = await categoryIds(db, source.slug)
    if (!ids.length) return []
    where.categoryId = { in: ids }
  }
  const rows = await db.product.findMany({
    where,
    include: PRODUCT_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })
  if (source.kind === 'manual') rows.sort((a, b) => source.productIds.indexOf(a.id) - source.productIds.indexOf(b.id))
  const serialized = rows.map(serializeProduct).filter((product) => product.image && product.stock >= 0)
  return source.kind === 'discount'
    ? serialized.filter((product) => product.compareAtPrice != null && product.compareAtPrice > product.price)
    : serialized
}

function bannerGroups(banners, slot) {
  const matches = banners.filter((banner) => banner.placement === 'inline' && banner.slot === slot)
  const groups = []
  for (let index = 0; index < matches.length; index += 1) {
    const banner = matches[index]
    if (banner.width === 'full') {
      groups.push({ id: banner.id, width: 'full', banners: [banner] })
      continue
    }
    const next = matches[index + 1]
    if (next?.width === 'half') {
      groups.push({ id: `${banner.id}-${next.id}`, width: 'half', banners: [banner, next] })
      index += 1
    }
  }
  return groups
}

function state(section, visible, reason = null) {
  return { id: section.id, type: section.type, active: section.active, visible, reason }
}

export async function resolveHome({ db, layout, settings = {}, now = new Date() }) {
  const banners = normalizeHomeBanners(settings.homeBanners)
  const currentBanners = banners.filter((banner) => isBannerLive(banner, now))
  const revalidateDates = banners.filter((banner) => banner.active).flatMap((banner) => futureDates([banner.startsAt, banner.endsAt], now))
  const states = []
  const sections = []
  let circles = null
  let hero = null

  for (const section of layout.sections) {
    if (!section.active) {
      states.push(state(section, false, 'Sección desactivada en el diseño.'))
      continue
    }
    const additional = await resolveAdditionalSection({ section, db, settings, banners: currentBanners, findProducts: findSourceProducts })
    if (additional) {
      if (additional.section) sections.push(additional.section)
      states.push(state(section, Boolean(additional.section), additional.reason || null))
      continue
    }
    if (section.type === 'hero') {
      const slides = currentBanners.filter((banner) => (banner.placement || 'hero') === 'hero')
      if (!slides.length) {
        states.push(state(section, false, 'No hay banners del hero activos y vigentes.'))
        continue
      }
      hero = { slides, config: settings.heroCarousel || { intervalSeconds: 6, autoplay: true } }
      sections.push({ id: section.id, type: section.type })
      states.push(state(section, true))
      continue
    }
    if (section.type === 'guestStrip' || section.type === 'reviews') {
      sections.push({ id: section.id, type: section.type, ...(section.message !== undefined ? { message: section.message } : {}), ...(section.buttonLabel !== undefined ? { buttonLabel: section.buttonLabel } : {}), ...(section.href !== undefined ? { href: section.href } : {}) })
      states.push(state(section, true))
      continue
    }
    if (section.type === 'circles') {
      const rows = await db.category.findMany({
        where: { visible: true, legacy: false },
        include: { _count: { select: { products: true } } },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      })
      const tree = buildCategoryTree(rows.map((row) => ({
        id: row.id, slug: row.slug, name: row.name, parentId: row.parentId, image: row.image,
        visible: row.visible, legacy: row.legacy, productCount: row._count.products,
      })))
      circles = circleItems(settings.homeCircles, tree)
      if (!circles.items.length) {
        states.push(state(section, false, 'No hay círculos con contenido válido.'))
        circles = null
        continue
      }
      sections.push({ id: section.id, type: section.type })
      states.push(state(section, true))
      continue
    }
    if (section.type === 'products') {
      const tabs = []
      for (const source of section.sources) {
        const products = await findSourceProducts(db, source, section.limit)
        if (products.length) tabs.push({ ...source, products })
      }
      if (!tabs.length) {
        states.push(state(section, false, 'Las fuentes seleccionadas no tienen productos disponibles.'))
        continue
      }
      sections.push({ id: section.id, type: section.type, title: section.title, tabs, limit: section.limit, ...(section.panel ? { panel: section.panel } : {}) })
      states.push(state(section, true))
      continue
    }
    if (section.type === 'campaign') {
      const endsAt = new Date(section.endsAt)
      revalidateDates.push(...futureDates([section.endsAt], now))
      if (endsAt <= now) {
        states.push(state(section, false, 'La campaña ya venció.'))
        continue
      }
      const products = await findSourceProducts(db, section.source, section.limit)
      if (!products.length) {
        states.push(state(section, false, 'La fuente de la campaña no tiene productos disponibles.'))
        continue
      }
      sections.push({ ...section, products })
      states.push(state(section, true))
      continue
    }
    if (section.type === 'inlineBanners') {
      const groups = bannerGroups(currentBanners, section.slot)
      if (!groups.length) {
        states.push(state(section, false, 'No hay banners completos o una pareja activa para este slot.'))
        continue
      }
      sections.push({ id: section.id, type: section.type, slot: section.slot, groups })
      states.push(state(section, true))
    }
  }

  const revalidateAt = revalidateDates.length ? Math.min(...revalidateDates.map((date) => date.getTime())) : null
  return {
    sections: sections.map(section => {
      const original = layout.sections.find(item => item.id === section.id)
      return original.appearance ? { ...section, appearance: original.appearance } : section
    }),
    hero,
    circles,
    states,
    revalidateAt: revalidateAt ? new Date(revalidateAt).toISOString() : null,
  }
}
