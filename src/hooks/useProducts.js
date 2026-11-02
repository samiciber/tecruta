import { useMemo } from 'react'
import { matchesCatalogFilters } from '../utils/catalogFilters.js'

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
    const result = list.filter((p) => matchesCatalogFilters(p, filters, query))

    const sorter = SORTERS[sort] || SORTERS.relevance
    return [...result].sort(sorter)
  }, [list, query, filters, sort])
}
