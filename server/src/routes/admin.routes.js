import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { serializeProduct, serializeCategory, serializeOrder, serializeUser } from '../lib/serializers.js'
import { uploadImageToCloudinary, uploadModelToCloudinary } from '../lib/cloudinary.js'

export const adminRouter = Router()

// Todo lo de este archivo requiere sesión + rol ADMIN. No existe ningún
// endpoint público que otorgue este rol — se asigna a mano con
// `npm run make-admin -- correo@ejemplo.com` (ver prisma/make-admin.js).
adminRouter.use(requireAuth, requireRole('ADMIN'))

const productInclude = { category: true, images: true }
const orderInclude = { items: { include: { product: true } }, paymentMethod: true }

// -----------------------------------------------------------------------
// Productos: crear, editar (precio, stock, destacado, etc.), eliminar.
// -----------------------------------------------------------------------

adminRouter.post(
  '/products',
  asyncHandler(async (req, res) => {
    const { category, slug, name, price } = req.body || {}
    if (!slug || !name || price === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: slug, name, price.' })
    }

    const categoryRow = await prisma.category.findUnique({ where: { slug: category } })
    if (!categoryRow) {
      return res.status(400).json({ error: `La categoría "${category}" no existe.` })
    }

    const { images, ...rest } = req.body
    const product = await prisma.product.create({
      data: {
        slug: rest.slug,
        name: rest.name,
        brand: rest.brand ?? null,
        description: rest.description ?? null,
        shortDescription: rest.shortDescription ?? null,
        price: rest.price,
        compareAtPrice: rest.compareAtPrice ?? null,
        stock: rest.stock ?? 0,
        featured: Boolean(rest.featured),
        bestSeller: Boolean(rest.bestSeller),
        image: rest.image ?? images?.[0] ?? null,
        tags: rest.tags ?? [],
        specifications: rest.specifications ?? null,
        model3DUrl: rest.model3DUrl ?? null,
        model3DPoster: rest.model3DPoster ?? null,
        enable3D: Boolean(rest.enable3D),
        hotspots: rest.hotspots ?? null,
        categoryId: categoryRow.id,
        images: images?.length ? { create: images.map((url, position) => ({ url, position })) } : undefined,
      },
      include: productInclude,
    })

    res.status(201).json(serializeProduct(product))
  }),
)

adminRouter.patch(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' })

    const { category, images, ...rest } = req.body || {}
    const data = {}

    // Solo actualiza los campos que efectivamente vinieron en el body —
    // el resto se mantiene tal cual (edición parcial).
    for (const field of [
      'slug', 'name', 'brand', 'description', 'shortDescription',
      'price', 'compareAtPrice', 'stock', 'featured', 'bestSeller',
      'image', 'tags', 'specifications',
      'model3DUrl', 'model3DPoster', 'enable3D', 'hotspots',
    ]) {
      if (rest[field] !== undefined) data[field] = rest[field]
    }

    if (category) {
      const categoryRow = await prisma.category.findUnique({ where: { slug: category } })
      if (!categoryRow) return res.status(400).json({ error: `La categoría "${category}" no existe.` })
      data.categoryId = categoryRow.id
    }

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id: existing.id }, data })

      if (Array.isArray(images)) {
        await tx.productImage.deleteMany({ where: { productId: existing.id } })
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((url, position) => ({ url, position, productId: existing.id })),
          })
        }
      }

      return tx.product.findUnique({ where: { id: existing.id }, include: productInclude })
    })

    res.json(serializeProduct(product))
  }),
)

adminRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' })

    try {
      await prisma.product.delete({ where: { id: existing.id } })
    } catch {
      // Restricción de llave foránea: el producto ya aparece en algún
      // pedido y no se puede borrar sin perder ese historial.
      return res.status(409).json({
        error: 'No se puede eliminar: este producto ya tiene pedidos asociados. Puedes ponerlo en stock 0 en su lugar.',
      })
    }

    res.status(204).end()
  }),
)

// POST /api/admin/uploads
// Sube una imagen (data URL en base64) a Cloudinary y devuelve la URL
// final. Lo usa ProductForm.jsx cuando el admin elige un archivo en vez
// de pegar una URL a mano.
adminRouter.post(
  '/uploads',
  asyncHandler(async (req, res) => {
    const { image } = req.body || {}
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Debes enviar una imagen como data URL (data:image/...;base64,...).' })
    }

    const url = await uploadImageToCloudinary(image)
    res.json({ url })
  }),
)

// POST /api/admin/uploads/model
// Igual que /uploads pero para el modelo 3D del producto (.glb/.gltf).
// Se sube como "raw" en Cloudinary (no es una imagen ni un video), a una
// carpeta separada. `filename` se usa solo para validar la extensión —
// el dato real viaja en `file` como data URL en base64.
adminRouter.post(
  '/uploads/model',
  asyncHandler(async (req, res) => {
    const { file, filename } = req.body || {}
    const ext = (filename || '').toLowerCase().split('.').pop()

    if (!file || typeof file !== 'string' || !file.startsWith('data:')) {
      return res.status(400).json({ error: 'Debes enviar el modelo como data URL en base64.' })
    }
    if (!['glb', 'gltf'].includes(ext)) {
      return res.status(400).json({ error: 'El archivo debe ser .glb o .gltf.' })
    }

    const url = await uploadModelToCloudinary(file)
    res.json({ url })
  }),
)

// -----------------------------------------------------------------------
// Categorías
// -----------------------------------------------------------------------

adminRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const { slug, name } = req.body || {}
    if (!slug || !name) return res.status(400).json({ error: 'Faltan campos obligatorios: slug, name.' })

    const category = await prisma.category.create({
      data: { slug, name, description: req.body.description ?? null, icon: req.body.icon ?? null },
    })
    res.status(201).json(serializeCategory(category))
  }),
)

adminRouter.patch(
  '/categories/:slug',
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findUnique({ where: { slug: req.params.slug } })
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada.' })

    const data = {}
    for (const field of ['name', 'description', 'icon']) {
      if (req.body?.[field] !== undefined) data[field] = req.body[field]
    }

    const category = await prisma.category.update({ where: { id: existing.id }, data })
    res.json(serializeCategory(category))
  }),
)

// -----------------------------------------------------------------------
// Métodos de pago
// -----------------------------------------------------------------------

adminRouter.get(
  '/payment-methods',
  asyncHandler(async (req, res) => {
    const methods = await prisma.paymentMethod.findMany({ orderBy: { key: 'asc' } })
    res.json(methods.map((m) => ({ key: m.key, label: m.label, active: m.active, config: m.config })))
  }),
)

adminRouter.patch(
  '/payment-methods/:key',
  asyncHandler(async (req, res) => {
    const existing = await prisma.paymentMethod.findUnique({ where: { key: req.params.key } })
    if (!existing) return res.status(404).json({ error: 'Método de pago no encontrado.' })

    const data = {}
    if (req.body?.label !== undefined) data.label = req.body.label
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active)
    if (req.body?.config !== undefined) data.config = req.body.config

    const paymentMethod = await prisma.paymentMethod.update({ where: { id: existing.id }, data })
    res.json({ key: paymentMethod.key, label: paymentMethod.label, active: paymentMethod.active, config: paymentMethod.config })
  }),
)

// -----------------------------------------------------------------------
// Pedidos: ver todos (no solo los propios) y cambiar de estado.
// -----------------------------------------------------------------------

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']

adminRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const where = req.query.status ? { status: req.query.status } : {}
    const orders = await prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' } })
    res.json(orders.map(serializeOrder))
  }),
)

adminRouter.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const { status, note } = req.body || {}
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}.` })
    }

    const existing = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
    if (!existing) return res.status(404).json({ error: 'Pedido no encontrado.' })

    const order = await prisma.$transaction(async (tx) => {
      // Si se cancela un pedido que no estaba cancelado, devuelve el
      // stock que se había descontado al crearlo.
      if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        for (const item of existing.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
        }
      }

      await tx.order.update({ where: { id: existing.id }, data: { status } })
      await tx.orderStatusHistory.create({
        data: { orderId: existing.id, status, note: note || null },
      })

      return tx.order.findUnique({ where: { id: existing.id }, include: orderInclude })
    })

    res.json(serializeOrder(order))
  }),
)

// -----------------------------------------------------------------------
// Clientes (solo lectura por ahora)
// -----------------------------------------------------------------------

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(users.map(serializeUser))
  }),
)