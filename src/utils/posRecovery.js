// Drafts contain identifiers/quantities, never trusted prices or verified payments.
const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const key = (kind, userId) => `tecruta:pos-${kind}:${userId}`
function parse(raw) {
  if (!raw || raw.length > 150000) throw new Error('El registro local de recuperación no es válido. Revisa el historial antes de realizar otro cobro.')
  return JSON.parse(raw)
}
export function readAttempt(userId) {
  const raw = localStorage.getItem(key('attempt', userId)) || sessionStorage.getItem(key('attempt', userId))
  if (!raw) return null
  const value = parse(raw)
  if (value.userId !== userId || !uuid(value.body?.requestId) || !/^\/(sales|cash)(\/[^/?#]{1,100}){0,3}$/.test(value.path)) throw new Error('Hay una operación local que no se pudo identificar. Revisa el historial y contacta al administrador antes de cobrar.')
  if (!localStorage.getItem(key('attempt', userId))) localStorage.setItem(key('attempt', userId), raw)
  sessionStorage.removeItem(key('attempt', userId))
  return value
}
export function saveAttempt(value) {
  localStorage.setItem(key('attempt', value.userId), JSON.stringify(value))
}
export function clearAttempt(userId, requestId) {
  const current = readAttempt(userId)
  if (current && current.body.requestId !== requestId) throw new Error('Otra pestaña tiene una operación pendiente. No se eliminó su recuperación.')
  sessionStorage.removeItem(key('attempt', userId))
  localStorage.removeItem(key('attempt', userId))
}
export function readDraft(userId) {
  const raw = localStorage.getItem(key('draft', userId))
  if (!raw) return null
  const value = parse(raw)
  if (value.version !== 1 || value.userId !== userId || !uuid(value.id) || !['cart', 'web', 'pending'].includes(value.kind) || !Array.isArray(value.items) || value.items.length > 100 || !Number.isFinite(value.updatedAt)) throw new Error('El carrito guardado no es válido. No se recuperó ninguna venta.')
  if (value.kind === 'cart' && value.items.some(item => typeof item.sku !== 'string' || item.sku.length > 40 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000)) throw new Error('El carrito guardado contiene cantidades o productos no válidos.')
  if (value.kind !== 'cart' && (typeof value.referenceId !== 'string' || value.referenceId.length > 100)) throw new Error('La referencia guardada no es válida.')
  return value
}
export function saveDraft(value) {
  const existing = readDraft(value.userId)
  if (existing && existing.id !== value.id) throw new Error('Otra pestaña conserva un carrito de esta cuenta. Vuelve a cargar para recuperarlo antes de preparar otra venta.')
  localStorage.setItem(key('draft', value.userId), JSON.stringify(value))
}
export function clearDraft(userId, id) {
  const current = readDraft(userId)
  if (!current || current.id === id) localStorage.removeItem(key('draft', userId))
}
export function draftExpired(value) { return Date.now() - value.updatedAt > 7 * 86400000 }
export async function withOperationLock(userId, work) {
  if (!navigator.locks) throw new Error('Este navegador no permite coordinar las pestañas de caja. Usa una versión actual de Edge o Chrome.')
  return navigator.locks.request(key('lock', userId), { ifAvailable: true }, lock => {
    if (!lock) throw new Error('Otra pestaña está procesando una operación de esta cuenta. Espera y consulta el resultado.')
    return work()
  })
}
