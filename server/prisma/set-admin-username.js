// Explicit DATABASE_URL from the operator's secret manager; does not read .env.
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { assignAdminUsername } from '../src/lib/adminUsername.js'

const { values } = parseArgs({ options: { email: { type: 'string' }, username: { type: 'string' }, apply: { type: 'boolean', default: false } } })
if (!values.email || !values.username || !process.env.DATABASE_URL) {
  console.error('Requiere DATABASE_URL en el entorno y --email CUENTA --username ALIAS. Sin --apply solo comprueba; no modifica cuentas.')
  process.exit(1)
}
const db = new PrismaClient()
try {
  const result = await assignAdminUsername(db, values.email, values.username, { apply: values.apply })
  console.log(result.applied ? 'Alias asignado a la cuenta ADMIN existente.' : 'Comprobación correcta. No se realizaron cambios.')
} catch {
  console.error('No se pudo asignar el alias. Comprueba migración, cuenta ADMIN verificada y disponibilidad del usuario; no se creó ninguna cuenta.')
  process.exitCode = 1
} finally { await db.$disconnect() }
