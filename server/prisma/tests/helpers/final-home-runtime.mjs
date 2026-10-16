import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import express from 'express'
import { spawn } from 'node:child_process'
import { createEmptyDotenv, createPrismaWorkspace, runDocker, runPrisma } from './isolated-runtime.mjs'

export async function createFinalHomeRuntime({ realInteractiveApi = false } = {}) {
  const root = fileURLToPath(new URL('../../../../', import.meta.url))
  const tempRoot = mkdtempSync(join(tmpdir(), 'tecruta-final-home-'))
  const container = `tecruta-final-home-${process.pid}-${Date.now()}`
  const previousCwd = process.cwd()
  let db, server, started = false
  const close = async () => {
    if (server) await new Promise(resolve => server.close(resolve))
    if (db) await db.$disconnect()
    process.chdir(previousCwd)
    if (started) runDocker(['rm', '--force', '--volumes', container])
    assert.ok(tempRoot.startsWith(join(tmpdir(), 'tecruta-final-home-')))
    try { rmSync(tempRoot, { recursive: true, force: true }) }
    catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EPERM' || !error.path?.startsWith(clientPathForCleanup)) throw error
      // Windows cannot unload Node's native Prisma DLL before the process exits.
      // A narrowly scoped child removes this one QA directory after its parent exits.
      const code = `const fs=require('node:fs'),p=require('node:path'),os=require('node:os');const dir=${JSON.stringify(tempRoot)},parent=${process.pid};if(!p.resolve(dir).startsWith(p.join(os.tmpdir(),'tecruta-final-home-')))process.exit(2);let tries=0;const timer=setInterval(()=>{try{process.kill(parent,0)}catch{clearInterval(timer);fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200})}if(++tries>300){clearInterval(timer);process.exit(3)}},200);`
      const child = spawn(process.execPath, ['-e', code], { detached: true, stdio: 'ignore', windowsHide: true }); child.unref()
    }
  }
  const clientPathForCleanup = join(tempRoot, 'client')
  try {
    const dotenvPath = createEmptyDotenv(tempRoot)
    runDocker(['run', '--detach', '--name', container, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=qa_final_home', '--env', 'POSTGRES_DB=qa_final_home', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'])
    started = true
    const port = runDocker(['port', container, '5432/tcp']).split(':').at(-1)
    const databaseUrl = `postgresql://qa_final_home@127.0.0.1:${port}/qa_final_home`
    let ready = false
    for (let i = 0; i < 40; i++) { try { runDocker(['exec', container, 'pg_isready', '-U', 'qa_final_home', '-d', 'qa_final_home']); ready = true; break } catch { await new Promise(resolve => setTimeout(resolve, 250)) } }
    if (!ready) throw new Error('PostgreSQL QA no está listo.')
    const workspace = createPrismaWorkspace({ tempRoot, name: 'schema', schemaSource: join(root, 'server/prisma/schema.prisma'), migrationsSource: join(root, 'server/prisma/migrations') })
    const clientPath = join(tempRoot, 'client')
    const schema = readFileSync(workspace.schemaPath, 'utf8').replace('provider = "prisma-client-js"', `provider = "prisma-client-js"\n  output = ${JSON.stringify(clientPath)}`)
    writeFileSync(workspace.schemaPath, schema)
    runPrisma({ root, tempRoot, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl, args: ['validate', '--schema', workspace.schemaPath] })
    runPrisma({ root, tempRoot, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl, args: ['migrate', 'deploy', '--schema', workspace.schemaPath] })
    runPrisma({ root, tempRoot, schemaPath: workspace.schemaPath, dotenvPath, databaseUrl, args: ['generate', '--schema', workspace.schemaPath] })
    process.env.DATABASE_URL = databaseUrl
    process.env.DOTENV_CONFIG_PATH = dotenvPath
    process.env.JWT_SECRET = 'qa-final-home-session-not-a-real-key'
    process.chdir(tempRoot)
    const generated = await import(pathToFileURL(join(clientPath, 'index.js')))
    db = new generated.PrismaClient({ datasources: { db: { url: databaseUrl } } })
    await db.$connect()
    const importRoot = path => import(pathToFileURL(join(root, path)))
    const { prisma } = await importRoot('server/src/lib/prisma.js')
    // Every real route uses this isolated client; no model points at an existing DB.
    for (const model of ['siteSetting', 'product', 'category', 'brand', 'user', 'navItem', 'popularSearch', 'store', 'cart', 'cartItem', 'savedItem']) {
      if (!prisma[model] || !db[model]) continue
      for (const method of ['findMany', 'findUnique', 'findFirst', 'create', 'createMany', 'update', 'upsert', 'delete', 'deleteMany', 'count']) prisma[model][method] = db[model][method].bind(db[model])
    }
    prisma.$transaction = db.$transaction.bind(db)
    const { contentRouter } = await importRoot('server/src/routes/content.routes.js')
    const { adminContentRouter } = await importRoot('server/src/routes/adminContent.routes.js')
    const { productsRouter } = await importRoot('server/src/routes/products.routes.js')
    const { categoriesRouter } = await importRoot('server/src/routes/categories.routes.js')
    const { createNewsletterRouter } = await importRoot('server/src/routes/newsletter.routes.js')
    const { errorHandler } = await importRoot('server/src/middleware/errorHandler.js')
    const { signToken } = await importRoot('server/src/lib/token.js')
    const requests = []
    const admin = await db.user.create({ data: { email: 'qa-admin@example.test', passwordHash: 'not-a-real-password', nombre: 'QA', apellido: 'Admin', role: 'ADMIN', verified: true } })
    const customer = await db.user.create({ data: { email: 'qa-customer@example.test', passwordHash: 'not-a-real-password', nombre: 'QA', apellido: 'Cliente', role: 'CUSTOMER', verified: true } })
    let realRouters
    if (realInteractiveApi) {
      const { default: bcrypt } = await importRoot('server/node_modules/bcryptjs/index.js')
      const passwordHash = await bcrypt.hash('qa-local-only', 10)
      await db.user.updateMany({ data: { passwordHash } })
      // Prepare both QA carts before the browser and smoke check use them.
      await db.cart.createMany({ data: [{ userId: admin.id }, { userId: customer.id }] })
      const [{ createAuthRouter }, { cartRouter }, { savedRouter }] = await Promise.all([
        importRoot('server/src/routes/auth.routes.js'), importRoot('server/src/routes/cart.routes.js'), importRoot('server/src/routes/saved.routes.js'),
      ])
      realRouters = { auth: createAuthRouter({ db, mailer: { verification: async () => {}, reset: async () => {} } }), cartRouter, savedRouter }
    }
    const auth = user => signToken({ sub: user.id, tokenVersion: 0 })
    const start = async (port = 0) => {
      const app = express()
      app.disable('x-powered-by'); app.use(express.json({ limit: '1mb' }))
      app.use((req, res, next) => { requests.push({ method: req.method, path: req.path }); res.set('Access-Control-Allow-Origin', realInteractiveApi ? process.env.CORS_ORIGIN : 'http://127.0.0.1:5177'); res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'); if (req.method === 'OPTIONS') return res.sendStatus(204); next() })
      if (realRouters) {
        app.use('/api/auth', realRouters.auth)
        app.use('/api/cart', realRouters.cartRouter)
        app.use('/api/saved', realRouters.savedRouter)
      } else {
      app.post('/api/auth/login', (req, res) => { const user = req.body.email === customer.email ? customer : admin; res.json({ user, token: auth(user) }) })
      app.get('/api/auth/me', (req, res) => res.json({ user: admin }))
      app.get('/api/cart', (req, res) => res.json({ items: [] }))
      app.get('/api/saved', (req, res) => res.json({ productIds: [] }))
      }
      app.use('/api/products', productsRouter); app.use('/api/categories', categoriesRouter)
      app.use('/api/admin', adminContentRouter); app.use('/api', createNewsletterRouter({ db })); app.use('/api', contentRouter)
      app.get('/fixtures/:name', (req, res) => {
        const scene = req.params.name.startsWith('scene')
        const accent = req.params.name.includes('audio') ? '#268a8a' : req.params.name.includes('carga') ? '#8964b4' : '#3d5afe'
        res.type('svg').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="${scene ? '#102a43' : '#eef1ff'}"/><circle cx="980" cy="170" r="240" fill="${accent}"/><path d="M0 650 Q300 200 1200 600 V700 H0Z" fill="${accent}"/><rect x="${scene ? 820 : 450}" y="170" width="220" height="370" rx="30" fill="#19354a" stroke="#c7d8ff" stroke-width="12"/><circle cx="${scene ? 930 : 560}" cy="490" r="13" fill="#c7d8ff"/></svg>`)
      })
      app.use(errorHandler)
      server = await new Promise((resolve, reject) => { const s = app.listen(port, '127.0.0.1', () => resolve(s)); s.once('error', reject) })
      return `http://127.0.0.1:${server.address().port}`
    }
    const restart = async (port = 0) => { if (server) await new Promise(resolve => server.close(resolve)); server = null; return start(port) }
    return { root, tempRoot, db, start, restart, close, admin, customer, auth, requests, container }
  } catch (error) { await close(); throw error }
}
