import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { validate } from '../middleware/validate.js'
import { addCartItemSchema, setCartItemQuantitySchema, mergeCartSchema } from '../lib/schemas.js'

export const cartRouter = Router()

// Todo este router es solo para clientes con sesión iniciada. Los
// invitados siguen usando el carrito en localStorage (ver
// src/context/CartContext.jsx en el frontend) — no tiene sentido
// persistir en la BD un carrito que no está atado a ninguna cuenta.
cartRouter.use(requireAuth)

async function getOrCreateCart(userId) {
  const existing = await prisma.cart.findUnique({ where: { userId }, include: { items: true } })
  if (existing) return existing
  return prisma.cart.create({ data: { userId }, include: { items: true } })
}

// Mismo shape que los "entries" que ya manejaba el carrito en
// localStorage: [{ productId, quantity }]. El precio, stock, nombre e
// imagen del producto se siguen resolviendo en el frontend contra el
// catálogo real (useProductIndex), nunca se cachean aquí.
function serializeCart(cart) {
  return { items: cart.items.map((it) => ({ productId: it.productId, quantity: it.quantity })) }
}

// Suma `quantity` al item existente (o lo crea), respetando el stock
// disponible del producto. Devuelve la cantidad final (puede ser 0 si no
// hay stock).
async function upsertCartItem(cart, productId, quantityToAdd) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return { error: 'PRODUCT_NOT_FOUND' }

  const existing = cart.items.find((it) => it.productId === productId)
  const nextQty = Math.min((existing?.quantity || 0) + Math.floor(quantityToAdd), Math.max(product.stock, 0))

  if (nextQty <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } })
    return { quantity: 0 }
  }

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity: nextQty },
    update: { quantity: nextQty },
  })
  return { quantity: nextQty }
}

// GET /api/cart
cartRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.id)
    res.json(serializeCart(cart))
  }),
)

// POST /api/cart/items  { productId, quantity }
// Suma `quantity` unidades del producto al carrito (o lo agrega si no
// estaba). Se usa cuando el cliente aprieta "Agregar al carrito".
cartRouter.post(
  '/items',
  validate(addCartItemSchema),
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body || {}

    const cart = await getOrCreateCart(req.user.id)
    const result = await upsertCartItem(cart, productId, quantity)
    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }

    const fresh = await getOrCreateCart(req.user.id)
    res.json(serializeCart(fresh))
  }),
)

// PATCH /api/cart/items/:productId  { quantity }
// Fija la cantidad exacta (no la suma). quantity <= 0 elimina el item.
// Se usa desde los controles +/- del carrito.
cartRouter.patch(
  '/items/:productId',
  validate(setCartItemQuantitySchema),
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    const { quantity } = req.body || {}

    const cart = await getOrCreateCart(req.user.id)

    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } })
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } })
      if (!product) return res.status(404).json({ error: 'Producto no encontrado.' })
      const clamped = Math.min(Math.floor(quantity), Math.max(product.stock, 0))
      if (clamped <= 0) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } })
      } else {
        await prisma.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId } },
          create: { cartId: cart.id, productId, quantity: clamped },
          update: { quantity: clamped },
        })
      }
    }

    const fresh = await getOrCreateCart(req.user.id)
    res.json(serializeCart(fresh))
  }),
)

// DELETE /api/cart/items/:productId
cartRouter.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.id)
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: req.params.productId } })
    const fresh = await getOrCreateCart(req.user.id)
    res.json(serializeCart(fresh))
  }),
)

// DELETE /api/cart — vaciar todo el carrito (se usa después de enviar el
// pedido por WhatsApp).
cartRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.id)
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    res.json({ items: [] })
  }),
)

// POST /api/cart/merge  { items: [{ productId, quantity }] }
// Se llama UNA sola vez, justo después de iniciar sesión: fusiona lo que
// el cliente tenía guardado como invitado (localStorage) con lo que ya
// hubiera en su carrito de servidor, sumando cantidades y respetando el
// stock. El frontend limpia el localStorage después de llamar a esto.
cartRouter.post(
  '/merge',
  validate(mergeCartSchema),
  asyncHandler(async (req, res) => {
    const items = req.body.items
    let cart = await getOrCreateCart(req.user.id)

    for (const entry of items) {
      if (!entry?.productId || !Number.isFinite(entry.quantity) || entry.quantity <= 0) continue
      await upsertCartItem(cart, entry.productId, entry.quantity)
      // Refrescamos el cart en memoria para que el siguiente item del
      // loop vea las cantidades ya actualizadas (por si el invitado tenía
      // el mismo producto repetido, aunque no debería pasar).
      cart = await getOrCreateCart(req.user.id)
    }

    res.json(serializeCart(cart))
  }),
)
