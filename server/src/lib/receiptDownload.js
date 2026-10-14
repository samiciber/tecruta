const MAX_BYTES = 8 * 1024 * 1024
const TYPES = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'application/pdf': 'pdf',
}

export function receiptReadError(status, message) {
  return Object.assign(new Error(message), { status })
}

export function trustedReceiptUrl(value) {
  if (typeof value !== 'string' || /[\s\\\x00-\x1f\x7f]/.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
        (url.port && url.port !== '443') || url.username || url.password || url.hash ||
        !/^\/[a-zA-Z0-9_-]+\/(image|raw)\/upload\/.+/.test(url.pathname)) return null
    return url.href
  } catch { return null }
}

export function receiptType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  const first = bytes.subarray(0, 6).toString('ascii')
  if (first === 'GIF87a' || first === 'GIF89a') return 'image/gif'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  return null
}

// Trusted host only, no redirects, bounded time and decoded bytes. No provider
// error body, URL, credentials or raw file content reaches logs or JSON errors.
export async function downloadReceipt(value, { fetcher = fetch, timeout = 10000 } = {}) {
  const url = trustedReceiptUrl(value)
  if (!url) throw receiptReadError(502, 'El comprobante guardado no se puede mostrar.')
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), timeout)
  let reader
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'error' })
    if (!response.ok || !response.body) throw new Error('receipt unavailable')
    const length = response.headers.get('content-length')
    if (length && Number(length) > MAX_BYTES) throw new Error('receipt too large')
    reader = response.body.getReader()
    const chunks = []; let size = 0
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      size += chunk.byteLength
      if (size > MAX_BYTES) throw new Error('receipt too large')
      chunks.push(Buffer.from(chunk))
    }
    const bytes = Buffer.concat(chunks)
    const type = receiptType(bytes)
    const declared = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (!type || (declared && declared !== 'application/octet-stream' && declared !== type)) throw new Error('receipt type rejected')
    return { bytes, type, extension: TYPES[type] }
  } catch {
    throw receiptReadError(502, 'No pudimos recuperar el comprobante. Inténtalo de nuevo.')
  } finally {
    clearTimeout(deadline)
    controller.abort()
    if (reader) { try { await reader.cancel() } catch {} }
  }
}
