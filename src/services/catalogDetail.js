// The public product index already contains the API's complete product DTO.
export async function resolveCatalogDetail({ entry, source, loadFallback, fetchProduct }) {
  if (!entry) return { status: source === 'api' ? 'not-found' : 'error' }
  if (source === 'api' && !entry.summary) return { status: 'ready', product: entry }
  if (source === 'api') {
    try {
      const product = await fetchProduct(entry.slug)
      return product ? { status: 'ready', product } : { status: 'not-found' }
    } catch (error) {
      return { status: error.status === 404 ? 'not-found' : 'error' }
    }
  }
  try {
    const products = await loadFallback(entry.category)
    const product = products.find(p => p.slug === entry.slug)
    return product ? { status: 'ready', product } : { status: 'error' }
  } catch { return { status: 'error' } }
}
