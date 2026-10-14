// Validate before opening the listening socket. Error messages contain names,
// never configuration values or URL credentials.
export function validateRuntimeEnv(env = process.env) {
  if (env.NODE_ENV !== 'production') return
  const required = ['JWT_SECRET', 'DATABASE_URL', 'CORS_ORIGIN']
  const missing = required.filter((name) => !env[name]?.trim() || env[name].includes('REPLACE_'))
  if (missing.length) throw new Error(`Configuración de producción incompleta: ${missing.join(', ')}.`)

  try {
    const url = new URL(env.DATABASE_URL)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error()
  } catch {
    throw new Error('DATABASE_URL debe ser una URL PostgreSQL válida.')
  }
  try {
    const url = new URL(env.CORS_ORIGIN)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== env.CORS_ORIGIN || url.username || url.password) throw new Error()
  } catch {
    throw new Error('CORS_ORIGIN debe ser un único origen HTTP(S), sin ruta, credenciales ni barra final.')
  }
}
