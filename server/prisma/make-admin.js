// Promueve una cuenta ya registrada a rol ADMIN.
//
// No existe (ni debe existir) un endpoint público para crear
// administradores — eso es una puerta de entrada peligrosa. Este script
// se corre a mano, desde tu propia máquina, con acceso directo a la base
// de datos.
//
// Uso:
//   npm run make-admin -- correo@ejemplo.com
//
// Requisito: la cuenta ya debe existir (haberse registrado y verificado
// normalmente desde /crear-cuenta) antes de promoverla.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email) {
    console.error('Uso: npm run make-admin -- correo@ejemplo.com')
    process.exitCode = 1
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No existe ninguna cuenta con el correo "${email}". Regístrala primero desde /crear-cuenta.`)
    process.exitCode = 1
    return
  }

  if (user.role === 'ADMIN') {
    console.log(`"${email}" ya tiene rol ADMIN. No se hizo ningún cambio.`)
    return
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
  console.log(`✔ "${email}" ahora es ADMIN.`)
}

main()
  .catch((err) => {
    console.error('✖ Error:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())