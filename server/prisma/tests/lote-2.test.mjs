// Run: node --test server/prisma/tests/lote-2.test.mjs (requires Docker).
// Every connection is generated here for an isolated, disposable container.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const migrations = join(root, 'server/prisma/migrations')
const schema = join(root, 'server/prisma/schema.prisma')
const cli = join(root, 'server/node_modules/.bin/prisma')
const name = '20261012000000_add_nav_brands_stores_saved_items'
const container = `tecruta-lote2-test-${process.pid}`
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
const legacySlugs = ['power-banks', 'cargadores', 'cables', 'audifonos', 'accesorios', 'celulares', 'tablets', 'laptops']
const temp = mkdtempSync(join(tmpdir(), 'tecruta-lote2-'))
let baseUrl
let started = false

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
function sql(db, input) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'qa_lote2', '-d', db], {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}
function prisma(db, ...args) {
  return execFileSync(cli, args, {
    cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, DATABASE_URL: `${baseUrl}/${db}` },
  })
}
function createDb(db) { sql('postgres', `CREATE DATABASE "${db}";`) }
function deploy(db, schemaPath = schema) { prisma(db, 'migrate', 'deploy', '--schema', schemaPath) }
function assertMatchesSchema(db) {
  // --exit-code returns 2 on drift; execFileSync fails the test in that case.
  const result = prisma(db, 'migrate', 'diff', '--from-schema-datasource', schema, '--to-schema-datamodel', schema, '--script', '--exit-code')
  assert.match(result, /This is an empty migration/)
}
function snapshot(db) {
  const tables = JSON.parse(sql(db, `SELECT json_agg(table_name ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations';`))
  return Object.fromEntries(tables.map(table => [table, JSON.parse(sql(db, `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY "${table === 'site_settings' ? 'key' : 'id'}"), '[]'::jsonb) FROM "${table}" t;`))]))
}

before(async () => {
  docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=qa_lote2', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image)
  started = true
  baseUrl = `postgresql://qa_lote2@${docker('port', container, '5432/tcp')}`
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { sql('postgres', 'SELECT 1;'); ready = true; break } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert.ok(ready, 'Disposable PostgreSQL started')
  cpSync(schema, join(temp, 'schema.prisma'))
  for (const entry of readdirSync(migrations)) {
    if (entry !== name) cpSync(join(migrations, entry), join(temp, 'migrations', entry), { recursive: true })
  }
})
after(() => {
  try { if (started) docker('rm', '--force', '--volumes', container) }
  finally { rmSync(temp, { recursive: true, force: true }) }
})

test('six migrations reproduce schema.prisma from an empty database and redeploy is a no-op', () => {
  createDb('fresh')
  deploy('fresh')
  assertMatchesSchema('fresh')
  createDb('shadow')
  assert.match(prisma('fresh', 'migrate', 'diff', '--from-migrations', migrations, '--to-schema-datamodel', schema,
    '--shadow-database-url', `${baseUrl}/shadow`, '--script', '--exit-code'), /This is an empty migration/)
  const history = sql('fresh', 'SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name;')
  assert.equal(history.split('\n').length, 6)
  assert.match(prisma('fresh', 'migrate', 'status', '--schema', schema), /Database schema is up to date/)
  assert.match(prisma('fresh', 'migrate', 'deploy', '--schema', schema), /No pending migrations/)
  assert.equal(sql('fresh', 'SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name;'), history)
})

test('upgrade from five migrations preserves every existing row and marks only the eight legacy slugs', () => {
  createDb('upgrade')
  deploy('upgrade', join(temp, 'schema.prisma'))
  sql('upgrade', readFileSync(new URL('./lote-2-fixtures.sql', import.meta.url), 'utf8'))
  const prior = snapshot('upgrade')
  deploy('upgrade')
  assertMatchesSchema('upgrade')
  const categories = JSON.parse(sql('upgrade', 'SELECT json_agg(slug ORDER BY slug) FROM "categories" WHERE legacy;'))
  assert.deepEqual(categories, [...legacySlugs].sort())
  for (const [table, rows] of Object.entries(prior)) {
    const actual = JSON.parse(sql('upgrade', `SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM "${table}" t;`))
    assert.deepEqual(actual.map(row => Object.fromEntries(Object.keys(rows[0]).map(key => [key, row[key]]))), rows, `${table}: all original fields and rows preserved`)
  }
  assert.equal(sql('upgrade', 'SELECT "categoryId", price, stock, "brandId" IS NULL FROM products;'), 'qa-category-power-banks|49.90|7|t')
  assert.equal(sql('upgrade', 'SELECT legacy, visible, position, "parentId" IS NULL FROM categories WHERE slug=\'qa-other-category\';'), 'f|t|0|t')
})

test('already matching schema and legacy data can be baselined without executing the migration again', () => {
  createDb('baseline')
  deploy('baseline', join(temp, 'schema.prisma'))
  sql('baseline', readFileSync(new URL('./lote-2-fixtures.sql', import.meta.url), 'utf8'))
  sql('baseline', readFileSync(join(migrations, name, 'migration.sql'), 'utf8'))
  assertMatchesSchema('baseline')
  assert.equal(sql('baseline', 'SELECT count(*) FROM categories WHERE legacy;'), '8')
  sql('baseline', `
    INSERT INTO brands (id, slug, name) VALUES ('qa-brand', 'qa-brand', 'QA brand');
    UPDATE products SET "brandId"='qa-brand' WHERE id='qa-product';
    INSERT INTO category_tiles (id, "categoryId", title) VALUES ('qa-tile', 'qa-category-power-banks', 'QA tile');
    INSERT INTO nav_items (id, "menuKey", label) VALUES ('qa-nav', 'quick', 'QA link');
    INSERT INTO popular_searches (id, text) VALUES ('qa-search', 'QA search');
    INSERT INTO stores (id, name, address1, city, active) VALUES ('qa-store', 'QA store', 'Fictitious', 'QA', false);
    INSERT INTO site_settings (key, value, "updatedAt") VALUES ('qa-setting', '{"qa":true}', '2026-01-01');
    INSERT INTO saved_items (id, "userId", "productId") VALUES ('qa-saved', 'qa-user', 'qa-product');
  `)
  const before = snapshot('baseline')
  prisma('baseline', 'migrate', 'resolve', '--applied', name, '--schema', schema)
  assert.match(prisma('baseline', 'migrate', 'deploy', '--schema', schema), /No pending migrations/)
  assert.deepEqual(snapshot('baseline'), before)
})

test('a failing statement rolls back the new schema and legacy update', () => {
  createDb('rollback')
  deploy('rollback', join(temp, 'schema.prisma'))
  sql('rollback', readFileSync(new URL('./lote-2-fixtures.sql', import.meta.url), 'utf8'))
  const before = snapshot('rollback')
  const migration = readFileSync(join(migrations, name, 'migration.sql'), 'utf8')
  assert.throws(() => sql('rollback', migration.replace('COMMIT;', 'SELECT 1 / 0;\nCOMMIT;')))
  assert.deepEqual(snapshot('rollback'), before)
  assert.equal(sql('rollback', "SELECT count(*) FROM pg_type WHERE typname='NavItemType';"), '0')
})
