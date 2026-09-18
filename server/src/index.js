import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { categoriesRouter } from './routes/categories.routes.js'
import { productsRouter } from './routes/products.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { ordersRouter } from './routes/orders.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { paymentMethodsRouter } from './routes/paymentMethods.routes.js'
import { cartRouter } from './routes/cart.routes.js'
import { addressesRouter } from './routes/addresses.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
// El límite por defecto de express.json() es 100kb — muy poco para una
// imagen o un modelo 3D en base64 (POST /api/admin/uploads y
// /uploads/model). 20mb es holgado para fotos de producto y modelos GLB
// de hasta ~15MB en crudo, sin abrir la puerta a payloads absurdamente
// grandes.
app.use(express.json({ limit: '20mb' }))

// Verificación rápida de que el servidor está vivo (útil para monitoreo
// y para que la app móvil futura confirme conectividad).
app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/categories', categoriesRouter)
app.use('/api/products', productsRouter)
app.use('/api/payment-methods', paymentMethodsRouter)
app.use('/api/auth', authRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/admin', adminRouter)
app.use('/api/cart', cartRouter)
app.use('/api/addresses', addressesRouter)

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))
app.use(errorHandler)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`✔ API de TecRuta corriendo en http://localhost:${PORT}`)
})