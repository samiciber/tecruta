export function normalizeAdminUsername(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!/^[a-z0-9][a-z0-9_-]{3,31}$/.test(normalized)) throw new Error('El usuario debe tener entre 4 y 32 letras ASCII, números, guiones o guiones bajos; sin @ ni espacios internos.')
  return normalized
}

// Never creates a user, assigns a role, or changes a password.
export async function assignAdminUsername(db, email, username, { apply = false } = {}) {
  const alias = normalizeAdminUsername(username)
  const normalizedEmail = String(email || '').trim().toLowerCase()
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw`SELECT id FROM users WHERE email = ${normalizedEmail} FOR UPDATE`
    if (!rows.length) throw new Error('La cuenta indicada no existe.')
    const user = await tx.user.findUnique({ where: { id: rows[0].id } })
    if (user.role !== 'ADMIN' || !user.verified) throw new Error('La cuenta debe ser ADMIN y tener correo verificado.')
    const other = await tx.user.findUnique({ where: { adminUsername: alias } })
    if (other && other.id !== user.id) throw new Error('El usuario ya está asignado a otra cuenta.')
    if (user.adminUsername && user.adminUsername !== alias) throw new Error('La cuenta ya tiene otro usuario; revisa el cambio explícitamente antes de reemplazarlo.')
    if (apply) await tx.user.update({ where: { id: user.id }, data: { adminUsername: alias } })
    return { applied: apply, username: alias }
  })
}
