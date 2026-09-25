import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { serializeOrder } from '../lib/serializers.js'
import { validate } from '../middleware/validate.js'
import { createOrderSchema } from '../lib/schemas.js'
import { uploadReceiptToCloudinary } from '../lib/cloudinary.js'

export const ordersRouter = Router()

const orderInclude = { items: { include: { product: true } }, paymentMethod: true }

function mapDeliveryType(tipoEntrega) {
  return tipoEntrega === 'recojo' ? 'PICKUP' : 'SHIPPING'
}

// POST /api/orders
//
// Se llama al confirmar el checkout, EN PARALELO al envío por WhatsApp —
// si esta llamada falla (backend caído, sin internet, etc.) el pedido
// igual se manda por WhatsApp con total normalidad. Esto solo deja el
// registro en la base de datos para el historial de compras y, más
// adelante, el panel de administración.
//
// Los precios y el stock se recalculan aquí con los datos reales de la
// base de datos — nunca se confía en los precios que manda el navegador.
ordersRouter.post(
  '/',
  optionalAuth,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const { customer, delivery, paymentMethod, items } = req.body || {}

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido no tiene productos.' })
    }

    const productIds = items.map((i) => i.productId).filter(Boolean)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const productById = new Map(products.map((p) => [p.id, p]))

    // Recalcula cantidades contra el stock real (nunca confía en lo que
    // mandó el navegador) y descarta ítems sin stock disponible.
    const resolvedItems = items
      .map((i) => {
        const product = productById.get(i.productId)
        if (!product) return null
        const quantity = Math.min(Math.max(1, Math.floor(i.quantity || 1)), Math.max(product.stock, 0))
        if (quantity <= 0) return null
        return { product, quantity }
      })
      .filter(Boolean)

    if (resolvedItems.length === 0) {
      return res.status(409).json({ error: 'Ninguno de los productos del pedido tiene stock disponible.' })
    }

    const subtotal = resolvedItems.reduce((sum, { product, quantity }) => sum + Number(product.price) * quantity, 0)
    const savings = resolvedItems.reduce((sum, { product, quantity }) => {
      if (!product.compareAtPrice || Number(product.compareAtPrice) <= Number(product.price)) return sum
      return sum + (Number(product.compareAtPrice) - Number(product.price)) * quantity
    }, 0)

    const paymentMethodRow = paymentMethod ? await prisma.paymentMethod.findUnique({ where: { key: paymentMethod } }) : null

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: req.user?.id ?? null,
          customerNombre: customer.nombre,
          customerApellido: customer.apellido,
          customerCorreo: customer.correo,
          customerCelular: customer.celular,
          deliveryType: mapDeliveryType(delivery.tipoEntrega),
          departamento: delivery.departamento,
          provincia: delivery.provincia,
          distrito: delivery.distrito,
          direccion: delivery.direccion || null,
          numero: delivery.numero || null,
          interior: delivery.interior || null,
          referencia: delivery.referencia || null,
          quiereComprobante: Boolean(delivery.quiereComprobante),
          documento: delivery.documento || null,
          otraPersona: Boolean(delivery.otraPersona),
          personaNombre: delivery.personaNombre || null,
          personaCelular: delivery.personaCelular || null,
          paymentMethodId: paymentMethodRow?.id ?? null,
          subtotal,
          savings,
          total: subtotal,
          items: {
            create: resolvedItems.map(({ product, quantity }) => ({
              productId: product.id,
              name: product.name,
              quantity,
              unitPrice: product.price,
            })),
          },
          statusHistory: {
            create: { status: 'PENDING', note: 'Pedido creado desde el checkout.' },
          },
        },
        include: orderInclude,
      })

      // Descuenta el stock vendido.
      for (const { product, quantity } of resolvedItems) {
        await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: quantity } } })
      }

      return created
    })

    res.status(201).json(serializeOrder(order))
  }),
)

// Tipos de archivo aceptados para el comprobante — solo imágenes o PDF.
const RECEIPT_ALLOWED_PREFIXES = ['data:image/', 'data:application/pdf']
// Mismo criterio de "estricto" que la subida de imágenes de producto del
// admin (ver MAX_UPLOAD_BYTES en src/pages/admin/ProductForm.jsx), con un
// poco más de margen porque una foto de comprobante tomada con el
// celular suele pesar más que una foto de producto ya optimizada.
const RECEIPT_MAX_BYTES = 8 * 1024 * 1024 // 8MB

// Calcula el tamaño real en bytes de una data URL en base64 (sin contar
// el prefijo "data:...;base64,"), para no depender de un Content-Length
// que el cliente podría falsear.
function base64DataUrlSizeInBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

// POST /api/orders/:orderId/receipt
//
// Sube el comprobante de pago (imagen o PDF) a Cloudinary y guarda la URL
// resultante en el pedido. Es un endpoint PÚBLICO a propósito (sin
// requireAuth ni auth de admin): el checkout permite comprar como
// invitado, así que el cliente que recién creó su pedido todavía puede
// no tener sesión iniciada. La única validación de "permiso" es que el
// pedido exista de verdad (si no, 404) — no hay otra restricción por
// diseño, según lo acordado.
//
// Este MISMO endpoint lo reutiliza el panel admin (AdminOrders.jsx) para
// subir o reemplazar el comprobante de un pedido manualmente — no hay un
// endpoint separado para eso.
ordersRouter.post(
  '/:orderId/receipt',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params
    const { file } = req.body || {}

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return res.status(404).json({ error: 'El pedido indicado no existe.' })
    }

    if (!file || typeof file !== 'string' || !RECEIPT_ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      return res.status(400).json({ error: 'El comprobante debe ser una imagen o un PDF (data URL en base64).' })
    }

    if (base64DataUrlSizeInBytes(file) > RECEIPT_MAX_BYTES) {
      return res.status(400).json({ error: 'El comprobante pesa demasiado (máximo 8MB).' })
    }

    const url = await uploadReceiptToCloudinary(file)

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { receiptUrl: url },
      include: orderInclude,
    })

    res.json({ url, order: serializeOrder(updated) })
  }),
)

// GET /api/orders/me — historial de compras del cliente autenticado.
ordersRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    })
    res.json(orders.map(serializeOrder))
  }),
)