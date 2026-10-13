// The public product index already contains the API's complete product DTO.
export async function resolveCatalogDetail({ entry, source, loadFallback }) {
  if (!entry) return { status: source === 'api' ? 'not-found' : 'error' }
  if (source === 'api') return { status: 'ready', product: entry }
  try {
    const products = await loadFallback(entry.category)
    const product = products.find(p => p.slug === entry.slug)
    return product ? { status: 'ready', product } : { status: 'error' }
  } catch { return { status: 'error' } }
}
