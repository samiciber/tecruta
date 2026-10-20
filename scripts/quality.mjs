import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)])
const mode = process.argv[2] || 'unit'
const unit = walk('server/tests').filter(path => path.endsWith('.test.mjs'))
const integration = walk('server/prisma/tests').filter(path => path.endsWith('.test.mjs'))
const current = ['inventory-part1', 'pos-part2', 'staff-system', 'product-reviews', 'order-emails', 'public-performance', 'store-search']
const selected = integration.filter(path => current.some(name => path.endsWith(name + '.test.mjs')))
const suites = { unit, integration: selected, all: [...unit, ...integration] }
const run = args => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status) process.exit(result.status)
}
if (mode === 'syntax') {
  const files = [...walk('server/src'), ...walk('serverless'), ...walk('api'), ...walk('scripts')]
    .filter(path => /\.(?:js|mjs)$/.test(path))
  for (const file of files) run(['--check', file])
  console.log(`Sintaxis correcta: ${files.length} archivos.`)
} else if (mode === 'build') {
  // Explicitly avoid Vite's automatic discovery of real .env files.
  const { build } = await import('vite')
  await build({ mode: 'store', envFile: false })
  await build({ mode: 'panel', envFile: false })
} else if (suites[mode]) {
  run(['--test', '--test-concurrency=1', ...suites[mode].sort()])
} else throw Error('Modo de calidad desconocido')
