import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import bcrypt from '../../node_modules/bcryptjs/index.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const source = process.env.TECRUTA_QA_MIGRATIONS_DIR || join(root, 'server/prisma/migrations')
const container = `tecruta-lote5-test-${process.pid}`
const temp = mkdtempSync(join(tmpdir(), 'tecruta-lote5-'))
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
const password = randomBytes(24).toString('hex')
let started, server, db, base, token
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options }).trim()
function docker(...args) {
  const env = { ...process.env }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
  return run('docker', ['--host=unix:///var/run/docker.sock', ...args], { env })
}
async function request(path, { method = 'GET', body, authenticated = false } = {}) {
  const response = await fetch(base + '/api/' + path, { method, headers: {
    'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  return { status: response.status, data: await response.json().catch(() => null) }
}
before(async () => {
  assert.ok(existsSync(join(source, '20261012000000_add_nav_brands_stores_saved_items/migration.sql')), 'Integra Lote 2 o usa su SQL sin cambios mediante TECRUTA_QA_MIGRATIONS_DIR.')
  docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=qa_lote5', '--env', 'POSTGRES_DB=qa_lote5', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image)
  started = true
  process.env.DOTENV_CONFIG_PATH = '/dev/null'
  process.env.DATABASE_URL = `postgresql://qa_lote5@${docker('port', container, '5432/tcp')}/qa_lote5`
  process.env.JWT_SECRET = randomBytes(32).toString('hex')
  process.env.CORS_ORIGIN = 'https://qa.example.invalid'
  process.env.TRUST_PROXY = '1'
  process.env.NODE_ENV = 'production'
  for (const key of ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) process.env[key] = ''
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'qa_lote5'); ready = true; break } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready)
  cpSync(join(root, 'server/prisma/schema.prisma'), join(temp, 'schema.prisma'))
  cpSync(source, join(temp, 'migrations'), { recursive: true })
  run(join(root, 'server/node_modules/.bin/prisma'), ['migrate', 'deploy', '--schema', join(temp, 'schema.prisma')], { cwd: root, env: { ...process.env } })
  db = (await import('../../src/lib/prisma.js')).prisma
  await db.category.create({ data: { id: 'qa-category', name: 'QA category', slug: 'qa-category', legacy: true } })
  await db.brand.create({ data: { id: 'qa-brand', name: 'QA brand', slug: 'qa-brand' } })
  await db.product.create({ data: { id: 'qa-product', name: 'QA product', slug: 'qa-product', brand: 'QA brand', brandId: 'qa-brand', categoryId: 'qa-category', price: '19.90', stock: 3, tags: ['qa'] } })
  await db.user.create({ data: { id: 'qa-customer', email: 'qa-customer@example.invalid', passwordHash: await bcrypt.hash(password, 10), nombre: 'QA', apellido: 'Customer', verified: true } })
  const { app } = await import('../../src/index.js')
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  if (db) await db.$disconnect()
  if (started) docker('rm', '--force', '--volumes', container)
  rmSync(temp, { recursive: true, force: true })
})
test('updated Express/Prisma serves catalog filters and detail from disposable Postgres', async () => {
  for (const path of ['products', 'products?category=qa-category', 'products?brand=qa-brand', 'products?q=QA']) {
    const result = await request(path)
    assert.equal(result.status, 200)
    assert.equal(result.data.length, 1)
    assert.equal(result.data[0].id, 'qa-product')
    assert.equal(result.data[0].price, 19.9)
  }
  assert.equal((await request('products/qa-product')).data.stock, 3)
  assert.equal((await request('products/qa-absent')).status, 404)
})
test('public navigation, category and payment routes retain their contracts', async () => {
  for (const path of ['categories', 'categories/tree', 'brands', 'nav', 'popular-searches', 'stores', 'site-settings', 'payment-methods']) {
    const result = await request(path)
    assert.equal(result.status, 200, path)
    assert.ok(result.data !== null, path)
  }
})
test('login and profile work, customer admin access is forbidden, private collections require auth', async () => {
  const result = await request('auth/login', { method: 'POST', body: { email: 'qa-customer@example.invalid', password } })
  assert.equal(result.status, 200)
  token = result.data.token
  assert.ok(typeof token === 'string')
  assert.equal((await request('auth/me', { authenticated: true })).data.user.id, 'qa-customer')
  assert.equal((await request('admin/products', { authenticated: true })).status, 403)
  for (const path of ['cart', 'saved', 'addresses', 'orders/me']) assert.equal((await request(path)).status, 401, path)
  for (const path of ['cart', 'saved', 'addresses', 'orders/me']) assert.equal((await request(path, { authenticated: true })).status, 200, path)
})
test('login rate limiting uses separate forwarded client IPs behind one proxy', async () => {
  const attempt = ip => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email: 'qa-absent@example.invalid', password }) })
  for (let i = 0; i < 8; i++) assert.equal((await attempt('192.0.2.80')).status, 401)
  assert.equal((await attempt('192.0.2.80')).status, 429)
  assert.equal((await attempt('192.0.2.81')).status, 401)
})
