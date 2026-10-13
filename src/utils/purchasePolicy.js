export function normalizeCart(stored) {
  if (!Array.isArray(stored)) return []
  const quantities = new Map()
  for (const entry of stored) {
    if (!entry || typeof entry.productId !== 'string' || !entry.productId || !Number.isFinite(entry.quantity)) continue
    const quantity = Math.max(1, Math.floor(entry.quantity))
    if (!Number.isSafeInteger(quantity)) continue
    quantities.set(entry.productId, Math.min(Number.MAX_SAFE_INTEGER, (quantities.get(entry.productId) || 0) + quantity))
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
}
export function canAddProduct(resource, product, quantity = 1) {
  if (!resource.isFresh() || !Number.isInteger(quantity) || quantity <= 0) return false
  const current = resource.getSnapshot().data.find(p => p.id === product?.id)
  return Boolean(current && current.stock >= quantity && current.price === product.price)
}
export function reviewCart(entries, products) {
  return entries.flatMap(entry => {
    const product = products.find(p => p.id === entry.productId)
    if (!product || product.stock < entry.quantity) return [{ ...entry, reason: !product ? 'missing' : 'stock' }]
    return []
  })
}
export function validateProducts(data) {
  if (!Array.isArray(data) || data.some(p => !p || typeof p.id !== 'string' || !p.id || typeof p.slug !== 'string' || !p.slug || typeof p.name !== 'string' || !Number.isFinite(p.price) || p.price < 0 || !Number.isInteger(p.stock) || p.stock < 0 || !Array.isArray(p.images) || p.images.some(image => typeof image !== 'string') || (p.compareAtPrice != null && (!Number.isFinite(p.compareAtPrice) || p.compareAtPrice < 0))) || new Set(data.map(p => p.id)).size !== data.length) throw new Error('El catálogo recibido no es válido.')
  return data
}
export function validatePayments(data) {
  const textFields = ['phoneNumber', 'holderName', 'bankName', 'accountNumber', 'cci', 'qrImageUrl', 'instructions']
  if (!Array.isArray(data) || data.some(m => !m || typeof m.key !== 'string' || !m.key || typeof m.label !== 'string' || !m.config || typeof m.config !== 'object' || Array.isArray(m.config) || textFields.some(key => m.config[key] != null && typeof m.config[key] !== 'string') || (m.config.availableFor !== undefined && (!Array.isArray(m.config.availableFor) || m.config.availableFor.some(v => typeof v !== 'string')))) || new Set(data.map(m => m.key)).size !== data.length) throw new Error('Los métodos de pago recibidos no son válidos.')
  return data.filter(m => m.active !== false)
}
