import { optimizeImage } from './imageUrl.js'

export const DEFAULT_STORE_ORIGIN = 'https://www.tecruta.com'
export const escapeMarkup = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
export const safeJsonLd = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
export const plainText = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const staticPages = {
  '/': ['TecRuta | Productos de tecnología', 'Consulta el catálogo de productos de TecRuta.'],
  '/catalogo': ['Catálogo de productos | TecRuta', 'Busca productos y consulta sus precios y disponibilidad en TecRuta.'],
  '/categorias': ['Categorías | TecRuta', 'Explora las categorías del catálogo de TecRuta.'],
  '/marcas': ['Marcas | TecRuta', 'Consulta las marcas disponibles en el catálogo de TecRuta.'],
  '/ayuda': ['Centro de ayuda | TecRuta', 'Consulta la información de atención y compra de TecRuta.'],
  '/legal/terminos': ['Términos y condiciones | TecRuta', 'Consulta los términos y condiciones publicados por TecRuta.'],
  '/legal/privacidad': ['Política de privacidad | TecRuta', 'Consulta la política de privacidad publicada por TecRuta.'],
}
export function publicRoute(path) {
  if (Object.hasOwn(staticPages, path)) return true
  return /^\/(producto|categoria|marca)\/[^/\\?#]+$/.test(path)
}
export function canonicalUrl(path, origin = DEFAULT_STORE_ORIGIN) {
  const base = new URL(origin)
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw Error('Invalid store origin')
  const target = new URL(path, base.origin)
  if (target.origin !== base.origin || /[\\\u0000-\u001f]/.test(path)) throw Error('Invalid canonical path')
  return target.origin + target.pathname
}
export function sharedImage(image, origin) {
  if (!image) return null
  try {
    const url = new URL(optimizeImage(image, 1200), origin)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function productStructuredData(product, origin = DEFAULT_STORE_ORIGIN) {
  const url = canonicalUrl('/producto/' + encodeURIComponent(product.slug), origin)
  const image = sharedImage(product.image || product.images?.[0], origin)
  const schema = {
    '@context': 'https://schema.org', '@type': 'Product', '@id': url + '#product',
    name: product.name, url,
    ...(image ? { image: [image] } : {}),
    ...(product.shortDescription || product.description ? { description: plainText(product.shortDescription || product.description).slice(0, 1000) } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
  }
  if (Number.isFinite(Number(product.price)) && Number(product.price) >= 0 && Number.isInteger(product.stock)) {
    schema.offers = { '@type': 'Offer', url, priceCurrency: 'PEN', price: Number(product.price).toFixed(2),
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
  }
  if (Number.isInteger(product.ratingCount) && product.ratingCount > 0 &&
    Number.isInteger(product.ratingSum) && product.ratingSum >= product.ratingCount && product.ratingSum <= 5 * product.ratingCount) {
    schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number((product.ratingSum / product.ratingCount).toFixed(2)), reviewCount: product.ratingCount }
  }
  return schema
}
export function organizationStructuredData(business, origin = DEFAULT_STORE_ORIGIN) {
  if (!business?.legalName?.trim()) return null
  return { '@context': 'https://schema.org', '@type': 'Organization', name: business.legalName, url: new URL(origin).origin,
    ...(business.ruc ? { taxID: business.ruc } : {}), ...(business.address ? { address: business.address } : {}) }
}
export function breadcrumbStructuredData(product, category, origin = DEFAULT_STORE_ORIGIN) {
  const rows = [{ name: 'Inicio', item: canonicalUrl('/', origin) }]
  if (category?.name && category?.slug) rows.push({ name: category.name, item: canonicalUrl('/categoria/' + encodeURIComponent(category.slug), origin) })
  rows.push({ name: product.name, item: canonicalUrl('/producto/' + encodeURIComponent(product.slug), origin) })
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: rows.map((row, index) => ({ '@type': 'ListItem', position: index + 1, ...row })) }
}
export function pageMetadata(path, { entity, origin = DEFAULT_STORE_ORIGIN, missing = false } = {}) {
  const page = staticPages[path] || ['TecRuta', 'Consulta el catálogo de TecRuta.']
  const type = path.split('/')[1]
  let [title, description] = page
  if (entity && ['producto', 'categoria', 'marca'].includes(type)) {
    title = `${entity.name} | ${type === 'producto' ? 'TecRuta' : type === 'marca' ? 'Marca en TecRuta' : 'Categoría en TecRuta'}`
    description = plainText(entity.shortDescription || entity.description) || `${type === 'producto' ? 'Consulta precio y disponibilidad de' : 'Explora los productos de'} ${entity.name} en TecRuta.`
  }
  return { title: title.slice(0, 160), description: description.slice(0, 320), canonical: canonicalUrl(path, origin),
    noindex: !publicRoute(path) || missing || (['producto', 'categoria', 'marca'].includes(type) && !entity),
    image: sharedImage(entity?.image || entity?.logo, origin), type: type === 'producto' ? 'product' : 'website' }
}
