import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { serializeOrder } from '../lib/serializers.js'
import { validate } from '../middleware/validate.js'
import { createOrderSchema } from '../lib/schemas.js'

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