// CI-only contract check against the explicitly disposable PostgreSQL service.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEmptyDotenv, createPrismaWorkspace, runPrisma } from '../server/prisma/tests/helpers/isolated-runtime.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const databaseUrl = process.env.TECRUTA_QA_SERVICE_URL
assert.ok(databaseUrl, 'Falta TECRUTA_QA_SERVICE_URL; este script no descubre archivos .env.')
const url = new URL(databaseUrl)
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.username, 'qa_ci')
assert.equal(url.password, '')
assert.equal(url.pathname, '/qa_ci')
const tempRoot = mkdtempSync(join(tmpdir(), 'tecruta-ci-'))
let db
try {
  const dotenvPath = createEmptyDotenv(tempRoot)
  const workspace = createPrismaWorkspace({ tempRoot, name: 'schema', schemaSource: join(root, 'server/prisma/schema.prisma'), migrationsSource: join(root, 'server/prisma/migrations') })
  const options = { root, tempRoot, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl }
  runPrisma({ ...options, args: ['validate', '--schema', workspace.schemaPath] })
  runPrisma({ ...options, args: ['migrate', 'deploy', '--schema', workspace.schemaPath] })
  const { PrismaClient } = await import('../server/node_modules/@prisma/client/default.js')
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  assert.equal((await db.$queryRaw`SELECT store_normalize_search('  AUDÍFONOS  Ñandú ') AS text`)[0].text, 'audifonos nandu')
  assert.equal((await db.$queryRaw`SELECT count(*)::int AS count FROM pg_indexes WHERE indexname LIKE '%_store_search_idx'`)[0].count, 3)
  assert.equal(await db.orderEmailDelivery.count(), 0)
  assert.equal(await db.product.count(), 0)
  assert.match(runPrisma({ ...options, args: ['migrate', 'diff', '--from-schema-datasource', workspace.schemaPath, '--to-schema-datamodel', workspace.schemaPath, '--exit-code'] }), /No difference detected/)
  console.log('Servicio PostgreSQL QA: migraciones, índices, outbox vacío y esquema comprobados.')
} finally {
  await db?.$disconnect()
  rmSync(tempRoot, { recursive: true, force: true })
}
