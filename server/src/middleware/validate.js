// Middleware genérico de validación con Zod. Se usa como
// `router.post('/ruta', validate(unSchema), asyncHandler(...))`.
//
// Si el body no cumple el schema, responde 400 con un mensaje claro
// (el primer error encontrado) y la lista completa de problemas, sin
// llegar a ejecutar el handler de la ruta. Si es válido, reemplaza
// `req.body` con los datos ya validados y "coaccionados" por Zod
// (strings recortados, números convertidos, etc.), para que el resto
// del código no tenga que repetir esas conversiones.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      const first = issues[0]
      return res.status(400).json({
        error: first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Datos inválidos.',
        issues,
      })
    }
    req.body = result.data
    next()
  }
}
