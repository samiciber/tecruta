// Generate the installed QA client's types without discovering any real .env.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEmptyDotenv, createPrismaWorkspace, runPrisma } from '../server/prisma/tests/helpers/isolated-runtime.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const tempRoot = mkdtempSync(join(tmpdir(), 'tecruta-qa-generate-'))
try {
  const dotenvPath = createEmptyDotenv(tempRoot)
  const workspace = createPrismaWorkspace({ tempRoot, name: 'schema', schemaSource: join(root, 'server/prisma/schema.prisma'), migrationsSource: join(root, 'server/prisma/migrations') })
  const output = join(root, 'server/node_modules/.prisma/client')
  writeFileSync(workspace.schemaPath, readFileSync(workspace.schemaPath, 'utf8').replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = ' + JSON.stringify(output)))
  runPrisma({ root, tempRoot, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl: 'postgresql://qa_generate@127.0.0.1:5432/qa_generate', args: ['generate', '--schema', workspace.schemaPath] })
  console.log('QA client generated without reading repository environment files.')
} finally { rmSync(tempRoot, { recursive: true, force: true }) }
