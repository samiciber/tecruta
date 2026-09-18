// Manejador de errores centralizado. Cualquier `next(err)` o excepción
// lanzada dentro de una ruta async (envuelta con asyncHandler) termina
// aquí, con una respuesta JSON consistente en vez de que Express devuelva
// HTML de error por defecto.
export function errorHandler(err, req, res, _next) {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor.' : err.message,
  })
}

// Envuelve un handler async para no repetir try/catch en cada ruta.
export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next)
}