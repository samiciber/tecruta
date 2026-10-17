import { createHmac } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { aggregateItems, canTransition, hashSecret, OrderError } from './orderPolicy.js'
import { InventoryError, recordConfirmedMovement } from './inventoryService.js'

export const orderInclude = {
  items: { include: { product: { select: { image: true, slug: true } } } },
  paymentMethod: true,
  posSale: { select: { id: true, status: true, confirmedAt: true, _count: { select: { refunds: true } } } },
}
const deliveryFields = ['tipoEntrega', 'departamento', 'provincia', 'distrito', 'direccion', 'numero', 'interior',
  'referencia', 'quiereComprobante', 'documento', 'otraPersona', 'personaNombre', 'personaCelular']
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
function guestToken(keyHash, requestHash, secret) {
  if (!secret) throw new OrderError(503, 'No se puede registrar el pedido en este momento.')
  return createHmac('sha256', secret).update(`tecruta:receipt:${keyHash}:${requestHash}`).digest('hex')
}
function rejected(status, message, productId) {
  const error = new OrderError(status, message, productId)
  // Emitted only after the keyed lock and existing-order lookup, with rollback.
  error.code = 'ORDER_REJECTED'
  return error
}

// Dependency injection allows local DB tests without calling external services.
export async function createOrder(db, body, user, idempotencyKey, secret) {
  if (typeof idempotencyKey !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(idempotencyKey)) {
    throw new OrderError(400, 'Falta una clave de idempotencia UUID válida.')
  }
  const items = aggregateItems(body.items)
  const delivery = Object.fromEntries(deliveryFields.map(key => [key, body.delivery[key] ?? null]))
  const payload = { customer: body.customer, delivery, paymentMethod: body.paymentMethod ?? null, items, userId: user?.id ?? null }
  const keyHash = hashSecret(idempotencyKey.toLowerCase())
  const requestHash = hashSecret(JSON.stringify(canonical(payload)))

  return db.$transaction(async tx => {
    // Serialize retries before stock checks, including concurrent identical requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 0))`
    const existing = await tx.order.findUnique({ where: { idempotencyKey: keyHash }, include: orderInclude })
    if (existing) {
      if (existing.requestHash !== requestHash) {
        const error = new OrderError(409, 'Esta clave ya pertenece a otro intento. No se creó otro pedido.')
        error.code = 'IDEMPOTENCY_CONFLICT'
        throw error
      }
      const token = existing.userId === null ? guestToken(keyHash, requestHash, secret) : null
      return { order: existing, replayed: true, receiptToken: token && hashSecret(token) === existing.receiptTokenHash ? token : undefined }
    }
    const products = await tx.product.findMany({
      where: { id: { in: items.map(item => item.productId) } },
      select: { id: true, name: true, price: true, compareAtPrice: true },
    })
    const byId = new Map(products.map(product => [product.id, product]))
    let subtotal = new Prisma.Decimal(0)
    let savings = new Prisma.Decimal(0)
    const resolved = []
    for (const { productId, quantity } of items) {
      const product = byId.get(productId)
      if (!product || product.price.lt(0)) throw rejected(409, 'Un producto ya no está disponible. Revisa el carrito.', productId)
      subtotal = subtotal.plus(product.price.mul(quantity))
      if (product.compareAtPrice?.gt(product.price)) savings = savings.plus(product.compareAtPrice.minus(product.price).mul(quantity))
      resolved.push({ productId, name: product.name, quantity, unitPrice: product.price })
    }
    if (subtotal.gt('99999999.99') || savings.gt('99999999.99')) throw rejected(400, 'El importe del pedido supera el máximo permitido.')
    const payment = payload.paymentMethod ? await tx.paymentMethod.findUnique({ where: { key: payload.paymentMethod } }) : null
    if (payload.paymentMethod && (!payment || !payment.active)) throw rejected(409, 'El método de pago ya no está disponible. Elige otro.')
    const receiptToken = user ? undefined : guestToken(keyHash, requestHash, secret)
    const order = await tx.order.create({
      data: {
        userId: user?.id ?? null,
        customerNombre: body.customer.nombre, customerApellido: body.customer.apellido,
        customerCorreo: body.customer.correo, customerCelular: body.customer.celular,
        deliveryType: delivery.tipoEntrega === 'recojo' ? 'PICKUP' : 'SHIPPING',
        departamento: delivery.departamento, provincia: delivery.provincia, distrito: delivery.distrito,
        direccion: delivery.direccion || null, numero: delivery.numero || null, interior: delivery.interior || null,
        referencia: delivery.referencia || null, quiereComprobante: Boolean(delivery.quiereComprobante),
        documento: delivery.documento || null, otraPersona: Boolean(delivery.otraPersona),
        personaNombre: delivery.personaNombre || null, personaCelular: delivery.personaCelular || null,
        paymentMethodId: payment?.id ?? null, subtotal, savings, total: subtotal,
        idempotencyKey: keyHash, requestHash, receiptTokenHash: receiptToken ? hashSecret(receiptToken) : null,
        items: { create: resolved },
        statusHistory: { create: { status: 'PENDING', note: 'Pedido creado desde el checkout.' } },
      }, include: orderInclude,
    })
    for (const { productId, quantity } of [...items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const expectedProduct = byId.get(productId)
      const result = await recordConfirmedMovement(tx, {
        productId,
        type: 'WEB_ORDER',
        direction: 'OUT',
        quantity,
        reason: `Reserva de pedido web ${order.id}`,
        reference: order.id,
        sourceKey: `web-order:${order.id}:${productId}`,
        createdById: user?.id ?? null,
        confirmedById: user?.id ?? null,
      }).catch(error => {
        if (error instanceof InventoryError) throw rejected(error.status, error.message, productId)
        throw error
      })
      const productAfterReservation = await tx.product.findUnique({
        where: { id: productId },
        select: { price: true, compareAtPrice: true },
      })
      const compareAtPriceChanged = expectedProduct.compareAtPrice === null
        ? productAfterReservation?.compareAtPrice !== null
        : !productAfterReservation?.compareAtPrice?.equals(expectedProduct.compareAtPrice)
      if (!productAfterReservation || !productAfterReservation.price.equals(expectedProduct.price) || compareAtPriceChanged) {
        throw rejected(409, `El stock o precio de "${expectedProduct.name}" cambió. Revisa el carrito.`, productId)
      }
      if (result.replayed) throw rejected(409, 'La reserva de stock del pedido ya fue aplicada.', productId)
    }
    return { order, receiptToken, replayed: false }
  }, { maxWait: 5000, timeout: 10000 })
}

export async function changeOrderStatus(db, id, status, note, userId = null) {
  return db.$transaction(async tx => {
    // Re-read after acquiring the row lock; simultaneous cancellations see CANCELLED.
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`
    const current = await tx.order.findUnique({ where: { id }, include: orderInclude })
    if (!current) throw new OrderError(404, 'Pedido no encontrado.')
    if (!canTransition(current.status, status)) throw new OrderError(409, `No se permite pasar de ${current.status} a ${status}.`)
    if (current.status === status) return current
    // Un cobro POS tiene su propio historial de reembolsos; una cancelación
    // administrativa no puede reponer de nuevo sus unidades.
    if (status === 'CANCELLED' && tx.posSale) {
      const linked = await tx.posSale.findUnique({ where: { orderId: id }, select: { confirmedAt: true } })
      if (linked?.confirmedAt) throw new OrderError(409, 'Este pedido fue cobrado en POS. Usa su devolución o anulación para conciliar dinero y stock.')
    }
    if (status === 'SHIPPED' && tx.posSale) {
      const linked = await tx.posSale.findUnique({ where: { orderId: id }, select: { _count: { select: { refunds: true } } } })
      if (linked?._count.refunds) throw new OrderError(409, 'El pedido tiene devoluciones POS. Concilia la venta antes de despachar; no se puede enviar el pedido original íntegro.')
    }
    if (status === 'CANCELLED') {
      for (const item of [...current.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
        await recordConfirmedMovement(tx, {
          productId: item.productId,
          type: 'WEB_CANCELLATION',
          direction: 'IN',
          quantity: item.quantity,
          reason: `Reposición por cancelación del pedido ${current.id}`,
          reference: current.id,
          sourceKey: `web-cancellation:${current.id}:${item.productId}`,
          createdById: userId,
          confirmedById: userId,
        })
      }
    }
    return tx.order.update({
      where: { id }, data: { status, statusHistory: { create: { status, note: note || null } } }, include: orderInclude,
    })
  }, { maxWait: 5000, timeout: 10000 })
}
