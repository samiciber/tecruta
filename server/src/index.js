import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRuntimeEnv, corsOrigins } from './lib/runtimeConfig.js'
import { apiSecurityHeaders } from './middleware/securityHeaders.js'
import { categoriesRouter } from './routes/categories.routes.js'
import { productsRouter } from './routes/products.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { ordersRouter } from './routes/orders.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { adminContentRouter } from './routes/adminContent.routes.js'
import { contentRouter } from './routes/content.routes.js'
import { savedRouter } from './routes/saved.routes.js'
import { paymentMethodsRouter } from './routes/paymentMethods.routes.js'
import { cartRouter } from './routes/cart.routes.js'
import { addressesRouter } from './routes/addresses.routes.js'
import { defaultJson } from './middleware/bodyLimits.js'
import { errorHandler } from './middleware/errorHandler.js'
import { newsletterRouter } from './routes/newsletter.routes.js'
import { inventoryRouter } from './routes/inventory.routes.js'
import { posRouter } from './routes/pos.routes.js'
import { staffRouter } from './routes/staff.routes.js'
import { reviewsRouter, reviewAdminRouter } from './routes/reviews.routes.js'

export function createApp({ orders = ordersRouter, admin = adminRouter, inventory = inventoryRouter, staff = staffRouter, auth = authRouter, reviews = reviewsRouter, reviewAdmin = reviewAdminRouter } = {}) {
  validateRuntimeEnv()
  const app = express()
  // Render has one proxy hop. Never trust every forwarded address.
  const proxyHops = Number(process.env.TRUST_PROXY ?? 1)
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) throw new Error('TRUST_PROXY debe ser un entero entre 0 y 5.')
  app.set('trust proxy', proxyHops)
  app.disable('x-powered-by')
  app.use(apiSecurityHeaders())

  const origins = corsOrigins()
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)) },
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))
  app.use(defaultJson)

  // Verificación rápida de que el servidor está vivo (útil para monitoreo
  // y para que la app móvil futura confirme conectividad).
  app.get('/api/health', (req, res) => res.json({ ok: true,
    ...(process.env.RENDER_GIT_COMMIT ? { revision: process.env.RENDER_GIT_COMMIT } : {}),
  }))

  app.use('/api/categories', categoriesRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/payment-methods', paymentMethodsRouter)
  app.use('/api/auth', auth)
  app.use('/api/orders', orders)
  app.use('/api/pos', posRouter)
  app.use('/api/reviews', reviews)
  app.use('/api/admin/reviews', reviewAdmin)
  // Inventory roles differ from the ADMIN-only routers mounted below.
  app.use('/api/admin/inventory', inventory)
  app.use('/api/admin/staff', staff)
  app.use('/api/admin', admin)
  app.use('/api/admin', adminContentRouter)
  app.use('/api/cart', cartRouter)
  app.use('/api/addresses', addressesRouter)
  app.use('/api', newsletterRouter)
  app.use('/api/saved', savedRouter)
  // Contenido público: /api/nav, /api/brands, /api/popular-searches,
  // /api/stores, /api/site-settings
  app.use('/api', contentRouter)

  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))
  app.use(errorHandler)

  return app
}
export const app = createApp()

const PORT = process.env.PORT || 4000
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  app.listen(PORT, () => {
    console.log(`✔ API de TecRuta corriendo en http://localhost:${PORT}`)
    if (process.env.ORDER_EMAILS_ENABLED === 'true') {
      void Promise.all([import('./lib/orderEmails.js'), import('./lib/prisma.js')])
        .then(([{ startOrderEmailWorker }, { prisma }]) => startOrderEmailWorker({ db: prisma }))
        .catch(() => console.error('ORDER_EMAIL_WORKER_START_FAILED'))
    }
  })
}
