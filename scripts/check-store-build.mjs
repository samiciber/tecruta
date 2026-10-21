import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

const base = JSON.parse(readFileSync('docs/lote-2/base.json', 'utf8'))
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
const main = readFileSync('dist/' + manifest['index.html'].file)
const bytes = main.length
assert.ok(bytes <= base.mainBytes * 1.1, 'El bundle principal excede +10%.')
for (const path of ['src/optional/analytics.js', 'src/optional/errors.js']) assert.equal(Object.hasOwn(manifest, path), false, 'Build apagado contiene un módulo opcional.')

// Compile enabled flags in memory only: no provider is ever contacted.
const enabled = await build({ mode: 'store', envFile: false, logLevel: 'error',
  define: { 'import.meta.env.VITE_ERROR_MONITOR_DSN': JSON.stringify('qa-compile-only'), 'import.meta.env.VITE_ANALYTICS_DOMAIN': JSON.stringify('shop.example.test') },
  build: { write: false, manifest: false } })
const chunks = enabled.output.filter(item => item.type === 'chunk')
const entry = chunks.find(item => item.isEntry)
for (const suffix of ['/src/optional/analytics.js', '/src/optional/errors.js']) {
  assert.ok(chunks.some(item => !item.isEntry && Object.keys(item.modules).some(name => name.replaceAll('\\', '/').endsWith(suffix))), 'Falta chunk diferido: ' + suffix)
  assert.equal(Object.keys(entry.modules).some(name => name.replaceAll('\\', '/').endsWith(suffix)), false)
}
assert.ok(Buffer.byteLength(entry.code) <= base.mainBytes * 1.1)
const result = { baseMainBytes: base.mainBytes, mainBytes: bytes, gzipBytes: gzipSync(main).length,
  growthPercent: Number(((bytes / base.mainBytes - 1) * 100).toFixed(2)), maximumGrowthPercent: 10,
  optionalEnabledMainBytes: Buffer.byteLength(entry.code), optionalModulesDeferred: true, disabledBuildHasNoOptionalChunks: true }
writeFileSync('docs/lote-2/bundle.json', JSON.stringify(result, null, 2) + '\n')
console.log(result)
