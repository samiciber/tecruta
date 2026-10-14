import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRuntimeEnv } from './lib/runtimeConfig.js'
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
import { errorHandler } from './middleware/errorHandler.js'

export function createApp({ orders = ordersRouter, admin = adminRouter } = {}) {
  validateRuntimeEnv()
  const app = express()
  // Render has one proxy hop. Never trust every forwarded address.
  const proxyHops = Number(process.env.TRUST_PROXY ?? 1)
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) throw new Error('TRUST_PROXY debe ser un entero entre 0 y 5.')
  app.set('trust proxy', proxyHops)
  app.disable('x-powered-by')
  app.use(apiSecurityHeaders())

  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
  // Upload limits are handled separately in Lote 3.
  app.use(express.json({ limit: '20mb' }))

  // Verificación rápida de que el servidor está vivo (útil para monitoreo
  // y para que la app móvil futura confirme conectividad).
  app.get('/api/health', (req, res) => res.json({ ok: true }))

  app.use('/api/categories', categoriesRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/payment-methods', paymentMethodsRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/orders', orders)
  app.use('/api/admin', admin)
  app.use('/api/admin', adminContentRouter)
  app.use('/api/cart', cartRouter)
  app.use('/api/addresses', addressesRouter)
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
  })
}
