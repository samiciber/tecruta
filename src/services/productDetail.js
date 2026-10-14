// Resuelve el detalle sin dejar una promesa rechazada ni sustituir un 404
// por un producto antiguo del respaldo. Las dependencias permiten probar
// los fallos de API/importación sin red ni base de datos.
export async function loadProductDetail({ slug, entry, fetchProduct, loadFallback }) {
  try {
    const product = await fetchProduct(slug)
    return product ? { status: 'ready', product } : { status: 'not-found' }
  } catch (error) {
    if (error?.status === 404) return { status: 'not-found' }
    if (entry) {
      try {
        const products = await loadFallback(entry.category)
        const product = products.find((item) => item.slug === slug)
        if (product) return { status: 'ready', product }
      } catch {
        // Las categorías nuevas pueden no tener un archivo estático.
      }
    }
    return { status: 'error' }
  }
}
