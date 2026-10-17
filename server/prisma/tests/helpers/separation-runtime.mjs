import { createFinalHomeRuntime } from './final-home-runtime.mjs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

// Disposable loopback PostgreSQL only; never loads the repository's .env files.
export async function createSeparationRuntime() {
  process.env.NODE_ENV = 'test'
  for (const key of ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[key]
  const rt = await createFinalHomeRuntime({ realInteractiveApi: true })
  const load = path => import(pathToFileURL(join(rt.root, path)))
  const { prisma } = await load('server/src/lib/prisma.js')
  for (const key of Object.keys(rt.db)) {
    if (key.startsWith('_') || key.startsWith('$') || !rt.db[key]?.findMany) continue
    prisma[key] = rt.db[key]
  }
  const { createApp } = await load('server/src/index.js')
  let server
  return { ...rt, load, password: 'qa-local-only',
    start: async () => {
      const app = createApp()
      server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject) })
      return `http://127.0.0.1:${server.address().port}`
    },
    close: async () => { if (server) await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); await rt.close() },
  }
}
