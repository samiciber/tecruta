export function checkedOrigin(value, name) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password || url.hostname.includes('*')) throw new Error()
    return url.origin
  } catch { throw new Error(`${name} debe contener orígenes HTTP(S) sin rutas, comodines, credenciales ni barra final.`) }
}
export function corsOrigins(env = process.env) {
  if (!env.CORS_ORIGINS) return [checkedOrigin(env.CORS_ORIGIN || 'http://localhost:5173', 'CORS_ORIGIN')]
  const entries = env.CORS_ORIGINS.split(',').map(value => value.trim())
  return [...new Set(entries.map(value => checkedOrigin(value, 'CORS_ORIGINS/CORS_ORIGIN')))]
}
export function storeOrigin(env = process.env) { return checkedOrigin(env.STORE_ORIGIN || corsOrigins(env)[0], 'STORE_ORIGIN') }
export function panelOrigin(env = process.env) { return checkedOrigin(env.PANEL_ORIGIN || 'http://127.0.0.1:5180', 'PANEL_ORIGIN') }

// Validate before opening the listening socket. Error messages contain names,
// never configuration values or URL credentials.
export function validateRuntimeEnv(env = process.env) {
  if (env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'DATABASE_URL', env.CORS_ORIGINS ? 'CORS_ORIGINS' : 'CORS_ORIGIN']
    const missing = required.filter(name => !env[name]?.trim() || env[name].includes('REPLACE_'))
    if (missing.length) throw new Error(`Configuración de producción incompleta: ${missing.join(', ')}.`)
  }
  const origins = corsOrigins(env)
  for (const key of ['STORE_ORIGIN', 'PANEL_ORIGIN']) {
    if (env[key] && !origins.includes(checkedOrigin(env[key], key))) throw new Error(`${key} debe estar incluido en CORS_ORIGINS/CORS_ORIGIN.`)
  }
  if (env.NODE_ENV !== 'production') return

  try {
    const url = new URL(env.DATABASE_URL)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error()
  } catch {
    throw new Error('DATABASE_URL debe ser una URL PostgreSQL válida.')
  }
}
