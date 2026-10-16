import { cartFooterLinksSchema } from './navSchemas.js'

const validAccess = item => Boolean(item.title && item.href)
const safeImage = value => typeof value === 'string' && /^(\/(?![\\/])|https?:\/\/)/.test(value) ? value : null

// Resolve only 5b sections. Existing 5a sections keep their original path.
export async function resolveAdditionalSection({ section, db, settings, banners, findProducts }) {
  const hidden = reason => ({ section: null, reason })
  if (section.type === 'splitRow') {
    const banner = banners.find(item => item.id === section.bannerId) || null
    let panel = null
    if (section.panelKind === 'products' && section.source) {
      const products = await findProducts(db, section.source, section.limit)
      if (products.length) panel = { kind: 'products', source: section.source, products }
    } else if (section.panelKind === 'categories' && section.categorySlugs.length) {
      const rows = await db.category.findMany({
        where: { slug: { in: section.categorySlugs }, visible: true, legacy: false },
        select: { slug: true, name: true, image: true },
      })
      const bySlug = new Map(rows.map(row => [row.slug, row]))
      const items = section.categorySlugs.map(slug => bySlug.get(slug)).filter(Boolean).slice(0, section.limit)
        .map(row => ({ id: row.slug, title: row.name, image: safeImage(row.image), href: `/categoria/${encodeURIComponent(row.slug)}` }))
      if (items.length) panel = { kind: 'categories', items }
    }
    if (!banner && !panel) return hidden('No hay banner vigente ni categorías o productos publicables.')
    return { section: { ...section, banner, panel }, reason: !banner ? 'Se muestra solo el panel: no hay banner vigente.' : !panel ? 'Se muestra solo el banner: el panel no tiene contenido publicable.' : null }
  }
  if (section.type === 'editorialTiles') {
    const items = section.items.filter(item => validAccess(item) && item.image)
    if (items.length !== section.columns) return hidden(`Completa los ${section.columns} tiles con imagen, título y enlace.`)
    return { section: { ...section, items } }
  }
  if (section.type === 'brands') {
    const rows = await db.brand.findMany({
      where: { visible: true }, orderBy: [{ featured: 'desc' }, { featuredPosition: 'asc' }, { name: 'asc' }],
      take: section.limit, select: { slug: true, name: true, logo: true },
    })
    if (!rows.length) return hidden('No hay marcas visibles.')
    return { section: { ...section, items: rows.map(row => ({ id: row.slug, title: row.name, image: safeImage(row.logo), href: `/marca/${encodeURIComponent(row.slug)}` })) } }
  }
  if (section.type === 'benefits') {
    const items = section.items.filter(item => item.title && item.text)
    if (!items.length) return hidden('No hay beneficios con título y texto completos.')
    return { section: { ...section, items } }
  }
  if (section.type === 'supportLinks') {
    const parsed = cartFooterLinksSchema.safeParse(settings.cartFooterLinks)
    if (!parsed.success) return hidden('Configura los accesos existentes en Ajustes del sitio → enlaces del carrito.')
    return { section: { ...section, items: parsed.data } }
  }
  if (section.type === 'legalText') {
    if (!section.text) return hidden('El texto legal está vacío.')
    return { section }
  }
  if (section.type === 'useSelections') {
    const tabs = section.tabs.map(tab => ({ ...tab, links: tab.links.filter(validAccess) }))
      .filter(tab => tab.label && tab.image && tab.links.length)
    if (!tabs.length) return hidden('No hay pestañas con nombre, imagen y al menos un acceso completo.')
    return { section: { ...section, tabs } }
  }
  return null
}
