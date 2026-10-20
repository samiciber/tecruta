import { randomUUID } from 'node:crypto'
const categories = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError'])
export function sanitizedError(error, source = 'backend') {
  const category = categories.has(error?.name) ? error.name : 'Error'
  // Discard message, stack, cause, URL, user, headers and bodies completely.
  return { platform: source === 'frontend' ? 'javascript' : 'node', level: 'error',
    message: `TecRuta ${source === 'frontend' ? 'frontend' : 'backend'}: ${category}`,
    tags: { source: source === 'frontend' ? 'frontend' : 'backend', category } }
}
export function sentryEndpoint(dsn) {
  try {
    const value = new URL(dsn)
    if (value.protocol !== 'https:' || value.password || value.port || value.search || value.hash ||
      !/^[a-f\d]{16,64}$/i.test(value.username) || !/^o\d+\.ingest(?:\.[a-z]+)?\.sentry\.io$/.test(value.hostname) || !/^\/\d+$/.test(value.pathname)) return null
    return value.origin + '/api' + value.pathname + '/envelope/'
  } catch { return null }
}
let sent = 0, windowStart = 0
export async function reportError(error, { dsn = process.env.ERROR_MONITOR_DSN, source = 'backend', send = fetch, now = Date.now() } = {}) {
  const endpoint = sentryEndpoint(dsn)
  if (!endpoint) return false
  if (now - windowStart >= 60000) { sent = 0; windowStart = now }
  if (sent++ >= 30) return false
  const eventId = randomUUID().replaceAll('-', '')
  const event = { ...sanitizedError(error, source), event_id: eventId, timestamp: now / 1000 }
  const envelope = [JSON.stringify({ event_id: eventId, sent_at: new Date(now).toISOString(), dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n') + '\n'
  try {
    const response = await send(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-sentry-envelope' }, body: envelope, signal: AbortSignal.timeout(2500), redirect: 'error' })
    return response.ok
  } catch { return false }
}
