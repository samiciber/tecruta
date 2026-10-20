import { API_URL } from '../services/api.js'
export const events = new Set(['pageview', 'Vista de producto', 'Agregar al carrito', 'Inicio de checkout', 'Pedido creado'])
export function track(name, { send = fetch, domain = import.meta.env.VITE_ANALYTICS_DOMAIN } = {}) {
  if (!domain || !events.has(name) || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return
  void send(API_URL + '/api/telemetry/analytics', {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(2500),
  }).catch(() => {})
}
