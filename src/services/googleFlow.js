const KEY = 'tecruta:google-proof:v1'
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export async function prepareGoogleFlow(storage, remember, webCrypto = crypto) {
  const verifier = base64url(webCrypto.getRandomValues(new Uint8Array(32)))
  const digest = await webCrypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  storage.setItem(KEY, JSON.stringify({ verifier, remember: Boolean(remember), expiresAt: Date.now() + 10 * 60 * 1000 }))
  return base64url(new Uint8Array(digest))
}
export function readGoogleFlow(storage) {
  try {
    const flow = JSON.parse(storage.getItem(KEY))
    if (typeof flow?.verifier === 'string' && /^[A-Za-z0-9_-]{43}$/.test(flow.verifier) && flow.expiresAt > Date.now()) return flow
  } catch {}
  return null
}
export function clearGoogleFlow(storage) { try { storage.removeItem(KEY) } catch {} }
