import { API_URL } from './api.js'

export async function getOrderReceipt(orderId, token, { signal } = {}) {
  const response = await fetch(`${API_URL}/api/orders/me/${encodeURIComponent(orderId)}/receipt`, {
    headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'No pudimos cargar el comprobante. Inténtalo de nuevo.')
  }
  const blob = await response.blob()
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'].includes(blob.type)) {
    throw new Error('El comprobante tiene un formato que no podemos mostrar.')
  }
  return blob
}

