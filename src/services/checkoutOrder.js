const ATTEMPT_KEY = 'tecruta:checkout-attempt:v1'

export function loadAttempt(storage) {
  try {
    const attempt = JSON.parse(storage.getItem(ATTEMPT_KEY))
    if (attempt?.version === 1 && typeof attempt.key === 'string' && typeof attempt.principal === 'string'
      && attempt.payload?.customer && attempt.payload?.delivery && Array.isArray(attempt.payload?.items)) return attempt
  } catch {}
  return null
}
export function saveAttempt(storage, payload, principal, uuid = () => crypto.randomUUID()) {
  const attempt = { version: 1, key: uuid(), principal, payload: structuredClone(payload) }
  // Persist before sending. A lost response/reload must retry the same request.
  try { storage.setItem(ATTEMPT_KEY, JSON.stringify(attempt)) }
  catch { throw new Error('El navegador no permite guardar el intento. Habilita el almacenamiento de esta pestaña y reintenta.') }
  return attempt
}
export function forgetAttempt(storage) { storage.removeItem(ATTEMPT_KEY) }
export function definitelyNotCreated(error, { retry = false } = {}) {
  // A 401/429 on a retry does not tell us whether the previous request committed.
  if (retry) return error.code === 'ORDER_REJECTED'
  return [400, 401, 403, 413, 429].includes(error.status)
    || (error.status === 409 && error.code !== 'IDEMPOTENCY_CONFLICT')
}
export async function submitAttempt(attempt, create, token) {
  const order = await create(attempt.payload, token, attempt.key)
  if (!order?.id || !Array.isArray(order.items) || !Number.isFinite(order.total)) {
    throw new Error('La respuesta del pedido está incompleta. Reintenta el mismo pedido.')
  }
  return order
}
