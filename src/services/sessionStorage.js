const TOKEN_KEY = 'tecruta:token'
export function browserStores(browser) {
  const unavailable = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable') }, removeItem: () => {} }
  const result = {}
  for (const [key, name] of [['local', 'localStorage'], ['session', 'sessionStorage']]) {
    try { result[key] = browser[name] } catch { result[key] = unavailable }
  }
  return result
}
function read(store) {
  try {
    const value = JSON.parse(store.getItem(TOKEN_KEY))
    return typeof value === 'string' && value ? value : null
  } catch { return null }
}
export function readSessionToken(local, session) { return read(session) || read(local) }
export function saveSessionToken(local, session, token, remember) {
  const target = remember ? local : session
  const other = remember ? session : local
  try {
    target.setItem(TOKEN_KEY, JSON.stringify(token))
    other.removeItem(TOKEN_KEY)
  } catch {
    try { target.removeItem(TOKEN_KEY) } catch {}
    throw new Error('El navegador no pudo guardar la sesión con esa preferencia. Habilita el almacenamiento y reintenta.')
  }
}
export function clearSessionToken(local, session) {
  for (const store of [local, session]) { try { store.removeItem(TOKEN_KEY) } catch {} }
}
export function shouldClearSession(error) { return error?.status === 401 }
