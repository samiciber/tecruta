// Compare compiled storefronts with the existing disposable QA fixture factory.
// No repository is edited, no .env is discovered, no production URL is called.
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, join, sep, extname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'

const current = fileURLToPath(new URL('../', import.meta.url))
const baseline = process.argv[2] === 'base'
assert.ok(baseline || process.argv[2] === 'current', 'Usa base o current.')
const checkout = baseline ? resolve(process.argv[3] || '') : current
assert.ok(existsSync(join(checkout, 'scripts/preview-store-reviews.mjs')))
for (const key of ['ORDER_EMAILS_ENABLED', 'ERROR_MONITOR_DSN', 'FRONTEND_ERROR_MONITOR_DSN', 'VITE_ERROR_MONITOR_DSN', 'VITE_ANALYTICS_DOMAIN', 'PLAUSIBLE_DOMAIN', 'PLAUSIBLE_ENDPOINT']) delete process.env[key]
const factoryPath = join(checkout, 'scripts/preview-store-reviews.mjs')
let source = readFileSync(factoryPath, 'utf8')
source = source.slice(0, source.indexOf('\nif(process.argv[1]'))
assert.ok(source.includes('return{...rt,shop,panel,password'))
// Export only the already-created QA API address for the local reverse proxy.
source = source.replace('return{...rt,shop,panel,password', 'return{...rt,api,shop,panel,password')
source = source.replace(/from\s*(['"])([^'"]+)\1/g, (match, quote, specifier) => {
  const target = specifier === 'vite' ? pathToFileURL(join(current, 'node_modules/vite/dist/node/index.js')).href
    : specifier.startsWith('.') ? new URL(specifier, pathToFileURL(factoryPath)).href : specifier
  return 'from ' + JSON.stringify(target)
})
const { createStoreReviewsPreview } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const port = baseline ? 5301 : 5303
const runtime = await createStoreReviewsPreview({ storePort: baseline ? 5207 : 5209, panelPort: baseline ? 5208 : 5210 })
let server
try {
  const output = join(runtime.tempRoot, 'compiled-store')
  // The fixture factory starts Vite development servers for its SVG assets.
  // Reset NODE_ENV explicitly so React's production build is measured.
  process.env.NODE_ENV = 'production'
  await build({ root: checkout, configFile: join(checkout, 'vite.config.js'), envFile: false, mode: 'store', logLevel: 'error',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:' + port), 'import.meta.env.VITE_STORE_ORIGIN': JSON.stringify('http://127.0.0.1:' + port) },
    build: { outDir: output, emptyOutDir: true }, cacheDir: join(runtime.tempRoot, 'build-cache') })
  const manifest = JSON.parse(readFileSync(join(output, '.vite/manifest.json'), 'utf8'))
  const entryBytes = statSync(join(output, manifest['index.html'].file)).size
  const reference = JSON.parse(readFileSync(join(current, 'docs/lote-2/base.json'), 'utf8')).mainBytes
  assert.ok(entryBytes <= reference * 1.1, 'El comparador no está usando el bundle de producción esperado.')
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
  server = createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end() }
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    if (path.startsWith('/api/')) {
      const upstream = request(runtime.api + req.url, { method: req.method, headers: { Accept: req.headers.accept || 'application/json', 'Accept-Encoding': req.headers['accept-encoding'] || 'identity' } }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res)
      })
      upstream.on('error', () => { res.writeHead(503); res.end() }); upstream.end(); return
    }
    let file
    try { file = resolve(output, '.' + decodeURIComponent(path)) } catch { res.writeHead(400); return res.end() }
    if (file !== output && !file.startsWith(output + sep)) { res.writeHead(404); return res.end() }
    if (!existsSync(file) || !statSync(file).isFile()) file = join(output, 'index.html')
    let body = readFileSync(file)
    res.setHeader('Content-Type', (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8')
    res.setHeader('Cache-Control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    if (/gzip/.test(req.headers['accept-encoding'] || '') && /\.(?:html|js|css|svg)$/.test(file)) { body = gzipSync(body); res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding') }
    res.end(req.method === 'HEAD' ? undefined : body)
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  console.log(`Compiled ${baseline ? 'base' : 'current'} QA ready on loopback port ${port}; entry=${entryBytes} bytes.`)
} catch (error) { await runtime.close(); throw error }
let closing = false
async function close() {
  if (closing) return
  closing = true
  await new Promise(resolve => server.close(resolve))
  await runtime.close()
  process.exit()
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close() })
