const events = new Set(['pageview', 'Vista de producto', 'Agregar al carrito', 'Inicio de checkout', 'Pedido creado'])
export function analyticsPayload(name, domain) {
  if (!events.has(name) || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(domain || '')) return null
  // Aggregate counts only. No forwarding client IP/UA, URL, referrer or IDs.
  return { name, domain, url: 'https://' + domain + '/tienda' }
}
export async function reportAnalytics(name, { env = process.env, send = fetch } = {}) {
  const payload = analyticsPayload(name, env.PLAUSIBLE_DOMAIN)
  if (!payload || !env.PLAUSIBLE_ENDPOINT) return false
  let endpoint
  try {
    endpoint = new URL(env.PLAUSIBLE_ENDPOINT)
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/api/event') return false
  } catch { return false }
  try {
    const result = await send(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'TecRuta-Store' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(2500), redirect: 'error' })
    return result.ok
  } catch { return false }
}
