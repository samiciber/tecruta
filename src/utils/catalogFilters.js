import { normalizeSearch, matchesSearch } from './searchText.js'
import { descendantSlugs } from './categoryTree.js'

const definitions = [
  ['ram', 'Memoria RAM', ['ram', 'memoria ram']],
  ['capacidad', 'Capacidad', ['capacidad', 'almacenamiento', 'capacidad de almacenamiento']],
  ['pantalla', 'Pantalla', ['pantalla', 'tamano de pantalla', 'tamano pantalla']],
  ['procesador', 'Procesador', ['procesador', 'cpu']],
  ['potencia', 'Potencia', ['potencia', 'potencia maxima', 'potencia de salida']],
  ['conexion', 'Conexión', ['conexion', 'conectividad', 'conector', 'interfaz']],
]
export const ATTRIBUTE_LABELS = Object.fromEntries(definitions.map(([key, label]) => [key, label]))
export const FILTER_SPEC_LABELS = definitions.flatMap(([, , aliases]) => aliases)

// Only short, explicitly recorded specifications become filters. No inference
// from names/descriptions and no transfer of full technical sheets in card DTOs.
export function productFilterAttributes(specifications) {
  const result = {}
  for (const spec of Array.isArray(specifications) ? specifications : []) {
    const definition = definitions.find(([, , aliases]) =>
      aliases.includes(normalizeSearch(spec?.label)),
    )
    if (!definition || typeof spec?.value !== 'string') continue
    const value = spec.value.trim().replace(/\s+/g, ' ')
    if (value && value.length <= 60 && !/[<>\r\n]/.test(value)) result[definition[0]] = value
  }
  return result
}

export function readAttributeFilters(params) {
  const attributes = {}
  for (const [key, value] of params) {
    const name = key.startsWith('f_') ? key.slice(2) : ''
    if (ATTRIBUTE_LABELS[name] && value && value.length <= 60) (attributes[name] ??= []).push(value)
  }
  return Object.fromEntries(
    Object.entries(attributes).map(([key, values]) => [key, [...new Set(values)]]),
  )
}

export function writeAttributeFilters(params, attributes = {}) {
  for (const key of [...params.keys()]) if (key.startsWith('f_')) params.delete(key)
  for (const key of Object.keys(ATTRIBUTE_LABELS)) {
    for (const value of attributes[key] || []) params.append('f_' + key, value)
  }
}

export function matchesCatalogFilters(product, filters = {}, query = '', except) {
  if (!matchesSearch(product, query)) return false
  const {
    category,
    categorySlugs,
    brands = [],
    minPrice,
    maxPrice,
    inStockOnly,
    attributes = {},
  } = filters
  if (
    except !== 'category' &&
    (categorySlugs?.length
      ? !categorySlugs.includes(product.category)
      : category && category !== product.category)
  )
    return false
  if (except !== 'brand' && brands.length && !brands.includes(product.brand)) return false
  if (
    (typeof minPrice === 'number' && product.price < minPrice) ||
    (typeof maxPrice === 'number' && product.price > maxPrice)
  )
    return false
  if (inStockOnly && product.stock <= 0) return false
  return Object.entries(attributes).every(
    ([key, values]) =>
      key === except || !values.length || values.includes(product.filterAttributes?.[key]),
  )
}

export function catalogFacets(products, tree, filters = {}, query = '') {
  const categories = []
  const categoryProducts = products.filter((p) =>
    matchesCatalogFilters(p, filters, query, 'category'),
  )
  const visit = (nodes, depth = 0) => {
    for (const node of nodes) {
      const slugs = new Set(descendantSlugs(node))
      const count = categoryProducts.filter((p) => slugs.has(p.category)).length
      if (count || filters.category === node.slug)
        categories.push({ slug: node.slug, name: node.name, depth, count })
      visit(node.children || [], depth + 1)
    }
  }
  visit(tree)
  const brandCounts = new Map()
  for (const p of products.filter((p) => matchesCatalogFilters(p, filters, query, 'brand')))
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1)
  for (const brand of filters.brands || []) if (!brandCounts.has(brand)) brandCounts.set(brand, 0)
  const brands = [...brandCounts]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([value, count]) => ({ value, count }))
  const attributes = []
  // Attributes appear after choosing a category (or when the scoped page has
  // only one category), so laptop RAM never becomes a generic cable filter.
  if (filters.category || new Set(categoryProducts.map((p) => p.category)).size === 1) {
    for (const [key, label] of Object.entries(ATTRIBUTE_LABELS)) {
      const counts = new Map()
      for (const p of products.filter((p) => matchesCatalogFilters(p, filters, query, key))) {
        const value = p.filterAttributes?.[key]
        if (value) counts.set(value, (counts.get(value) || 0) + 1)
      }
      for (const value of filters.attributes?.[key] || [])
        if (!counts.has(value)) counts.set(value, 0)
      if (counts.size > 1 || filters.attributes?.[key]?.length)
        attributes.push({
          key,
          label,
          options: [...counts]
            .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
            .map(([value, count]) => ({ value, count })),
        })
    }
  }
  return { categories, brands, attributes }
}
