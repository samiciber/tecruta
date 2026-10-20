// Manejador de errores centralizado. Cualquier `next(err)` o excepción
// lanzada dentro de una ruta async (envuelta con asyncHandler) termina
// aquí, con una respuesta JSON consistente en vez de que Express devuelva
// HTML de error por defecto.
export function errorHandler(err, req, res, _next) {
  // Database details may contain request values: expose only stable messages.
  const databaseErrors = {
    P2002: [409, 'Ya existe un registro con esos datos.'],
    P2025: [404, 'El registro ya no existe.'],
    P2003: [409, 'El registro tiene relaciones que impiden esta operación.'],
  }
  const mapped = Object.hasOwn(databaseErrors, err.code) ? databaseErrors[err.code] : null
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1] })
  const status = err.status || 500
  // Never log request bodies, uploaded files or capabilities.
  if (status >= 500) console.error('Error del servidor:', err.name, err.code || 'unknown')
  if (status >= 500 && process.env.ERROR_MONITOR_DSN) {
    void import('../optional/errorMonitor.js').then(module => module.reportError(err)).catch(() => {})
  }
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor.' : status === 413 ? 'El archivo o solicitud supera el tamaño permitido.' : err.type === 'entity.parse.failed' ? 'JSON inválido.' : err.message,
    ...(err.productId ? { productId: err.productId } : {}),
    ...(['IDEMPOTENCY_CONFLICT', 'ORDER_REJECTED'].includes(err.code) ? { code: err.code } : {}),
  })
}

// Envuelve un handler async para no repetir try/catch en cada ruta.
export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next)
}
