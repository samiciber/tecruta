import { PrismaClient } from '@prisma/client'

// Una sola instancia de PrismaClient para toda la app (evita agotar
// conexiones a la base de datos al recargar en desarrollo).
export const prisma = new PrismaClient()