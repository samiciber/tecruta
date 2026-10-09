// Migra los banners del Home guardados con la forma ANTERIOR
// (title/subtitle/ctaLabel/href/image) a la forma nueva del Cambio 2
// (descripción, botones, imágenes escritorio/móvil, posición, alineación, etc.).
// Valores por defecto de lo migrado: hero · abajo-izquierda · texto a la izquierda.
//
// Es IDEMPOTENTE (volver a ejecutarlo no cambia nada) y NO es obligatorio: la API
// ya normaliza al leer. Ejecútalo para dejar la BD en la forma nueva:
//   npm run migrate:banners
// Haz antes un respaldo:  pg_dump "$DATABASE_URL" > backup_banners.sql
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { normalizeHomeBanners } from '../src/lib/navSchemas.js'

const prisma = new PrismaClient()
try {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'homeBanners' } })
  if (!row || !Array.isArray(row.value)) {
    console.log('No hay banners guardados: nada que migrar.')
  } else {
    const migrated = normalizeHomeBanners(row.value)
    const dropped = row.value.length - migrated.length
    if (JSON.stringify(migrated) === JSON.stringify(row.value)) {
      console.log(`Ya están en la forma nueva (${migrated.length} banners). Nada que hacer.`)
    } else {
      await prisma.siteSetting.update({ where: { key: 'homeBanners' }, data: { value: migrated } })
      console.log(`✔ ${migrated.length} banner(s) migrado(s).${dropped ? ` ⚠ ${dropped} omitido(s) por datos inválidos.` : ''}`)
    }
  }
} catch (err) {
  console.error('✖ Error migrando banners:', err)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}