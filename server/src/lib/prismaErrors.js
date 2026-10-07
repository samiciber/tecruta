// Traduce errores conocidos de Prisma a respuestas HTTP claras.
// P2002 (violación de unicidad) → 409; P2025 (registro no existe) → 404.
// Uso: await guard(res, () => prisma.x.create(...), 'Ya existe un registro con ese slug.')
export async function guard(fn, conflictMessage = 'Ya existe un registro con esos datos.') {
  try {
    return await fn()
  } catch (err) {
    if (err?.code === 'P2002') {
      const e = new Error(conflictMessage)
      e.status = 409
      throw e
    }
    if (err?.code === 'P2025') {
      const e = new Error('Registro no encontrado.')
      e.status = 404
      throw e
    }
    throw err
  }
}

export function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}