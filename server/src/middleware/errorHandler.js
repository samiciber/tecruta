// Manejador de errores centralizado. Cualquier `next(err)` o excepción
// lanzada dentro de una ruta async (envuelta con asyncHandler) termina
// aquí, con una respuesta JSON consistente en vez de que Express devuelva
// HTML de error por defecto.
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500
  // Never log request bodies, uploaded files or capabilities.
  if (status >= 500) console.error('Error del servidor:', err.name, err.code || 'unknown')
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
