import { useMemo } from 'react'
import { matchesSearch } from '../utils/searchText.js'

const SORTERS = {
  relevance: (a, b) => Number(b.featured) - Number(a.featured),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  newest: (a, b) => b.id.localeCompare(a.id),
  discount: (a, b) => {
    const da = a.compareAtPrice ? (a.compareAtPrice - a.price) / a.compareAtPrice : 0
    const db = b.compareAtPrice ? (b.compareAtPrice - b.price) / b.compareAtPrice : 0
    return db - da
  },
}

export function useProducts(list, { query = '', filters = {}, sort = 'relevance' } = {}) {
  return useMemo(() => {
    const { category, categorySlugs, brands = [], minPrice, maxPrice, inStockOnly } = filters
    let result = list.filter((p) => matchesSearch(p, query))

    // categorySlugs = el nodo elegido + sus descendientes (árbol de categorías)
    if (categorySlugs?.length) result = result.filter((p) => categorySlugs.includes(p.category))
    else if (category) result = result.filter((p) => p.category === category)
    if (brands.length > 0) result = result.filter((p) => brands.includes(p.brand))
    if (typeof minPrice === 'number') result = result.filter((p) => p.price >= minPrice)
    if (typeof maxPrice === 'number') result = result.filter((p) => p.price <= maxPrice)
    if (inStockOnly) result = result.filter((p) => p.stock > 0)

    const sorter = SORTERS[sort] || SORTERS.relevance
    return [...result].sort(sorter)
  }, [list, query, filters, sort])
}
