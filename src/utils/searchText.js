export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
export function matchesSearch(product, query) {
  const text = normalizeSearch(product.searchText || [product.name, product.brand, product.category, ...(product.tags || [])].join(' '))
  return normalizeSearch(query).split(' ').filter(Boolean).every(token => text.includes(token))
}
