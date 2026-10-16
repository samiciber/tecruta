import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import express from 'express'
import { createEmptyDotenv, createPrismaWorkspace, runDocker, runPrisma } from './helpers/isolated-runtime.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const container = `tecruta-home-test-${process.pid}`
const image = 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
const tempRoot = mkdtempSync(join(tmpdir(), 'tecruta-home-'))
const dotenvPath = createEmptyDotenv(tempRoot)
const previousCwd = process.cwd()
const previousEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  DOTENV_CONFIG_PATH: process.env.DOTENV_CONFIG_PATH,
  JWT_SECRET: process.env.JWT_SECRET,
}
let workspace
let databaseUrl
let containerStarted = false
let server
let prisma
let signToken
let contentRouter
let adminContentRouter

const importFromRoot = (path) => import(pathToFileURL(join(root, path)))

function startServer() {
  const app = express()
  app.use(express.json())
  app.use('/api', contentRouter)
  app.use('/api/admin', adminContentRouter)
  return new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
}

async function stopServer() {
  if (!server) return
  const current = server
  server = null
  await new Promise((resolve, reject) => current.close((error) => error ? reject(error) : resolve()))
}

function baseUrl() {
  return `http://127.0.0.1:${server.address().port}`
}

function token(user) {
  return signToken({ sub: user.id, tokenVersion: user.tokenVersion ?? 0 })
}

async function request(path, { method = 'GET', auth, body } = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { response, body: await response.json() }
}

async function createCategory({ slug, name, visible = true, legacy = false, product: productData }) {
  return prisma.category.create({
    data: {
      slug, name, visible, legacy, image: 'https://qa.invalid/category.webp',
      ...(productData ? {
        products: {
          create: {
            slug: productData.slug,
            name: productData.name,
            price: '25.00',
            compareAtPrice: null,
            stock: 3,
            featured: productData.featured ?? false,
            bestSeller: false,
            image: `https://qa.invalid/${productData.slug}.webp`,
            tags: [],
            images: { create: [{ url: `https://qa.invalid/${productData.slug}-detail.webp`, position: 0 }] },
          },
        },
      } : {}),
    },
    include: { products: true },
  })
}

const banner = ({ id, title, placement, width = 'full', active = true, slot = '' }) => ({
  id,
  title,
  imageDesktop: `https://qa.invalid/${id}.webp`,
  active,
  placement,
  width,
  slot,
})

before(async () => {
  runDocker(['run', '--detach', '--name', container, '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=qa_home', '--env', 'POSTGRES_DB=qa_home',
    '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image])
  containerStarted = true
  const mappedPort = runDocker(['port', container, '5432/tcp']).split(':').at(-1)
  databaseUrl = `postgresql://qa_home@127.0.0.1:${mappedPort}/qa_home`
  let lastError
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      runDocker(['exec', container, 'pg_isready', '-U', 'qa_home', '-d', 'qa_home'])
      ready = true
      break
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  if (!ready) throw new Error('El PostgreSQL desechable no quedó listo.', { cause: lastError })
  workspace = createPrismaWorkspace({
    tempRoot,
    name: 'home-layout',
    schemaSource: join(root, 'server', 'prisma', 'schema.prisma'),
    migrationsSource: join(root, 'server', 'prisma', 'migrations'),
  })
  runPrisma({
    root,
    tempRoot,
    schemaPath: workspace.schemaPath,
    dotenvPath,
    databaseUrl,
    args: ['migrate', 'deploy', '--schema', workspace.schemaPath],
  })

  process.env.DATABASE_URL = databaseUrl
  process.env.DOTENV_CONFIG_PATH = dotenvPath
  process.env.JWT_SECRET = 'home-integration-test-only-secret'
  process.chdir(tempRoot)

  prisma = (await importFromRoot(join('server', 'src', 'lib', 'prisma.js'))).prisma
  signToken = (await importFromRoot(join('server', 'src', 'lib', 'token.js'))).signToken
  contentRouter = (await importFromRoot(join('server', 'src', 'routes', 'content.routes.js'))).contentRouter
  adminContentRouter = (await importFromRoot(join('server', 'src', 'routes', 'adminContent.routes.js'))).adminContentRouter
  await prisma.$connect()
  server = await startServer()
})

after(async () => {
  try {
    await stopServer()
    if (prisma) await prisma.$disconnect()
    if (containerStarted) runDocker(['rm', '--force', '--volumes', container])
  } finally {
    process.chdir(previousCwd)
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('Home routes persist and resolve the ADMIN layout against disposable PostgreSQL', async () => {
  const [{ invalidatedResourcesFor }, { homeDefaults }] = await Promise.all([
    importFromRoot(join('src', 'services', 'liveResource.js')),
    importFromRoot(join('server', 'src', 'lib', 'homeDefaults.js')),
  ])
  const admin = await prisma.user.create({
    data: { email: 'admin@qa.invalid', passwordHash: 'synthetic-only', nombre: 'QA', apellido: 'Admin', role: 'ADMIN' },
  })
  const customer = await prisma.user.create({
    data: { email: 'customer@qa.invalid', passwordHash: 'synthetic-only', nombre: 'QA', apellido: 'Customer', role: 'CUSTOMER' },
  })
  const adminToken = token(admin)
  const customerToken = token(customer)

  const publicRoute = await request('/api/home')
  assert.equal(publicRoute.response.status, 200)

  for (const [method, path, body] of [
    ['GET', '/api/admin/home-layout'],
    ['PUT', '/api/admin/home-layout', { sections: [] }],
  ]) {
    assert.equal((await request(path, { method, body })).response.status, 401, `${method} without a session`)
    assert.equal((await request(path, { method, auth: customerToken, body })).response.status, 403, `${method} as a customer`)
  }
  const adminGet = await request('/api/admin/home-layout', { auth: adminToken })
  assert.equal(adminGet.response.status, 200)
  assert.equal(adminGet.body.isDefault, true)
  assert.deepEqual(adminGet.body.layout, homeDefaults)

  const visible = await createCategory({
    slug: 'qa-visible-category',
    name: 'Visible QA',
    product: { slug: 'qa-featured-product', name: 'Featured QA', featured: true },
  })
  await createCategory({
    slug: 'qa-hidden-category', name: 'Hidden QA', visible: false,
    product: { slug: 'qa-hidden-product', name: 'Hidden QA product' },
  })
  await createCategory({
    slug: 'qa-legacy-category', name: 'Legacy QA', legacy: true,
    product: { slug: 'qa-legacy-product', name: 'Legacy QA product' },
  })
  const banners = [
    banner({ id: 'qa-hero-live', title: 'Live hero', placement: 'hero' }),
    banner({ id: 'qa-hero-disabled', title: 'Disabled hero', placement: 'hero', active: false }),
    banner({ id: 'qa-inline-a', title: 'Inline A', placement: 'inline', width: 'half', slot: 'qa-slot' }),
    banner({ id: 'qa-inline-b', title: 'Inline B', placement: 'inline', width: 'half', slot: 'qa-slot' }),
    banner({ id: 'qa-inline-inactive', title: 'Inactive inline', placement: 'inline', slot: 'qa-slot', active: false }),
    banner({ id: 'qa-inline-orphan', title: 'Orphan inline', placement: 'inline', width: 'half', slot: 'qa-slot' }),
  ]
  const saveBanners = await request('/api/admin/site-settings/homeBanners', {
    method: 'PUT', auth: adminToken, body: banners,
  })
  assert.equal(saveBanners.response.status, 200)

  const layout = {
    sections: [
      { id: 'hero', type: 'hero', active: true },
      { id: 'featured', type: 'products', active: true, title: 'Featured', limit: 4,
        sources: [{ id: 'featured-source', label: 'Featured', kind: 'featured', href: '/catalogo?featured=true' }] },
      { id: 'hidden-category', type: 'products', active: true, title: 'Hidden category', limit: 4,
        sources: [{ id: 'hidden-source', label: 'Hidden', kind: 'category', slug: 'qa-hidden-category' }] },
      { id: 'legacy-category', type: 'products', active: true, title: 'Legacy category', limit: 4,
        sources: [{ id: 'legacy-source', label: 'Legacy', kind: 'category', slug: 'qa-legacy-category' }] },
      { id: 'empty-category', type: 'products', active: true, title: 'Empty category', limit: 4,
        sources: [{ id: 'empty-source', label: 'Missing', kind: 'category', slug: 'qa-missing-category' }] },
      { id: 'disabled', type: 'products', active: false, title: 'Disabled', limit: 4,
        sources: [{ id: 'disabled-source', label: 'Featured', kind: 'featured' }] },
      { id: 'inline', type: 'inlineBanners', active: true, slot: 'qa-slot' },
      { id: 'circles', type: 'circles', active: true },
    ],
  }
  const saved = await request('/api/admin/home-layout', { method: 'PUT', auth: adminToken, body: layout })
  assert.equal(saved.response.status, 200)
  assert.deepEqual(saved.body.layout, layout)

  const invalidLayout = { sections: [{ id: 'duplicate', type: 'hero' }, { id: 'duplicate', type: 'circles' }] }
  const rejected = await request('/api/admin/home-layout', { method: 'PUT', auth: adminToken, body: invalidLayout })
  assert.equal(rejected.response.status, 400)
  assert.deepEqual((await prisma.siteSetting.findUnique({ where: { key: 'homeLayout' } })).value, layout)

  const home = await request('/api/home')
  assert.equal(home.response.status, 200)
  assert.deepEqual(home.body.sections.map((section) => section.id), ['hero', 'featured', 'inline', 'circles'])
  assert.deepEqual(home.body.hero.slides.map((slide) => slide.id), ['qa-hero-live'])
  assert.deepEqual(home.body.sections.find((section) => section.id === 'featured').tabs[0].products.map((item) => item.id), [visible.products[0].id])
  assert.deepEqual(home.body.sections.find((section) => section.id === 'inline').groups.map((group) => group.banners.map((item) => item.id)), [
    ['qa-inline-a', 'qa-inline-b'],
  ])
  assert.deepEqual(home.body.circles.items.map((item) => item.label), ['Visible QA'])
  assert.deepEqual(home.body.states.map((state) => [state.id, state.visible]), [
    ['hero', true], ['featured', true], ['hidden-category', false], ['legacy-category', false],
    ['empty-category', false], ['disabled', false], ['inline', true], ['circles', true],
  ])
  for (const id of ['hidden-category', 'legacy-category', 'empty-category', 'disabled']) {
    assert.ok(home.body.states.find((state) => state.id === id).reason)
  }

  const updatedBanners = banners.map((item) => item.id === 'qa-inline-a' ? { ...item, title: 'Updated inline A' } : item)
  const updateContent = await request('/api/admin/site-settings/homeBanners', {
    method: 'PUT', auth: adminToken, body: updatedBanners,
  })
  assert.equal(updateContent.response.status, 200)
  assert.ok(invalidatedResourcesFor('PUT', '/api/admin/site-settings/homeBanners').includes('home'))
  assert.ok(invalidatedResourcesFor('POST', '/api/admin/products').includes('home'))
  const refreshed = await request('/api/home')
  assert.equal(refreshed.body.sections.find((section) => section.id === 'inline').groups[0].banners[0].title, 'Updated inline A')

  await stopServer()
  server = await startServer()
  const afterRestart = await request('/api/home')
  assert.deepEqual(afterRestart.body.sections.map((section) => section.id), ['hero', 'featured', 'inline', 'circles'])
  assert.equal(afterRestart.body.sections.find((section) => section.id === 'inline').groups[0].banners[0].title, 'Updated inline A')
  const adminAfterRestart = await request('/api/admin/home-layout', { auth: adminToken })
  assert.equal(adminAfterRestart.response.status, 200)
  assert.deepEqual(adminAfterRestart.body.layout, layout)
})
