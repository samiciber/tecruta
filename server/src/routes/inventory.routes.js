import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  inventoryBarcodeSchema,
  inventoryLookupSchema,
  inventoryDraftSchema,
  inventoryMovementFiltersSchema,
  inventoryProductSearchSchema,
  inventoryReversalSchema,
} from '../lib/inventorySchemas.js'
import { createDraftMovement, confirmDraftMovement, movementDirection, reverseMovement } from '../lib/inventoryService.js'
import { ensureBarcodeAvailable, normalizeBarcode } from '../lib/productIdentity.js'

const inventoryRouter = Router()
const canReadInventory = requireRole('ADMIN', 'WAREHOUSE', 'CASHIER')
const canManageInventory = requireRole('ADMIN', 'WAREHOUSE')

const productSelect = {
  id: true,
  slug: true,
  sku: true,
  name: true,
  brand: true,
  image: true,
  price: true,
  stock: true,
  barcodes: { orderBy: { createdAt: 'asc' } },
}

inventoryRouter.use(requireAuth)
inventoryRouter.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })

inventoryRouter.get('/summary', canReadInventory, asyncHandler(async (_req, res) => {
  const [products, low, out, drafts] = await Promise.all([
    prisma.product.aggregate({ _sum: { stock: true }, _count: { _all: true } }),
    prisma.product.count({ where: { stock: { gt: 0, lte: 5 } } }),
    prisma.product.count({ where: { stock: 0 } }),
    prisma.inventoryMovement.count({ where: { status: 'DRAFT' } }),
  ])
  res.json({ productCount: products._count._all, unitsOnHand: products._sum.stock ?? 0, lowStock: low, outOfStock: out, drafts })
}))

inventoryRouter.get('/operators', canReadInventory, asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { OR: [
      { role: { in: ['ADMIN', 'WAREHOUSE', 'CASHIER'] } },
      { inventoryMovements: { some: { status: 'CONFIRMED' } } },
      { confirmedInventoryMovements: { some: { status: 'CONFIRMED' } } },
    ] },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, apellido: true, role: true },
  })
  res.json(users)
}))

inventoryRouter.get('/products', canReadInventory, asyncHandler(async (req, res) => {
  const parsed = inventoryProductSearchSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Búsqueda de inventario inválida.' })
  const { q, page, pageSize } = parsed.data
  const normalized = q.toUpperCase()
  const where = q ? {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: normalized } },
      { barcodes: { some: { normalizedCode: { contains: normalized } } } },
    ],
  } : {}
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, select: productSelect, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ])
  res.json({ rows: rows.map(row => ({ ...row, price: Number(row.price) })), total, page, pageSize })
}))

inventoryRouter.get('/lookup', canReadInventory, asyncHandler(async (req, res) => {
  const parsed = inventoryLookupSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Código de búsqueda inválido.' })
  const normalized = normalizeBarcode(parsed.data.code).normalizedCode
  const barcode = await prisma.productBarcode.findUnique({ where: { normalizedCode: normalized }, include: { product: { select: productSelect } } })
  const product = barcode?.product ?? await prisma.product.findUnique({ where: { sku: normalized }, select: productSelect })
  if (!product) return res.status(404).json({ error: 'Código desconocido. Busca el producto manualmente o registra el código.' })
  res.json({ ...product, price: Number(product.price) })
}))

inventoryRouter.get('/labels', canManageInventory, asyncHandler(async (req, res) => {
  const ids = typeof req.query.ids === 'string' ? [...new Set(req.query.ids.split(',').filter(Boolean))] : []
  if (!ids.length || ids.length > 50 || ids.some(id => id.length > 60)) return res.status(400).json({ error: 'Selecciona entre 1 y 50 productos.' })
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, sku: true, price: true, barcodes: { select: { code: true, kind: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  res.json(products.map(product => ({ ...product, price: Number(product.price) })))
}))

inventoryRouter.post('/products/:productId/barcodes', canManageInventory, asyncHandler(async (req, res) => {
  const parsed = inventoryBarcodeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Código de barras inválido.' })
  const barcode = normalizeBarcode(parsed.data.code)
  const created = await prisma.$transaction(async tx => {
    // Orden compatible con el editor: producto antes del identificador.
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${req.params.productId} FOR KEY SHARE`
    const product = await tx.product.findUnique({ where: { id: req.params.productId }, select: { id: true, sku: true } })
    if (!product) return null
    await ensureBarcodeAvailable(tx, barcode.code)
    return tx.productBarcode.create({
      data: { ...barcode, kind: parsed.data.kind, productId: product.id },
    })
  })
  if (!created) return res.status(404).json({ error: 'Producto no encontrado.' })
  res.status(201).json(created)
}))

inventoryRouter.delete('/products/:productId/barcodes/:barcodeId', canManageInventory, asyncHandler(async (req, res) => {
  const deleted = await prisma.productBarcode.deleteMany({
    where: { id: req.params.barcodeId, productId: req.params.productId },
  })
  if (!deleted.count) return res.status(404).json({ error: 'Código de barras no encontrado.' })
  res.status(204).end()
}))

const parseFilters = req => inventoryMovementFiltersSchema.safeParse(req.query)
const movementWhere = filters => ({
  status: 'CONFIRMED',
  ...(filters.productId ? { productId: filters.productId } : {}),
  ...(filters.type ? { type: filters.type } : {}),
  ...(filters.userId ? { OR: [{ createdById: filters.userId }, { confirmedById: filters.userId }] } : {}),
  ...(filters.from || filters.to ? {
    occurredAt: {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    },
  } : {}),
})
const movementInclude = {
  product: { select: { id: true, name: true, sku: true } },
  createdBy: { select: { id: true, nombre: true, apellido: true } },
  confirmedBy: { select: { id: true, nombre: true, apellido: true } },
  reversalOf: { select: { id: true } },
  reversals: { select: { id: true } },
}

inventoryRouter.get('/movements', canReadInventory, asyncHandler(async (req, res) => {
  const parsed = parseFilters(req)
  if (!parsed.success) return res.status(400).json({ error: 'Filtros de movimientos inválidos.' })
  const { page, pageSize, ...filters } = parsed.data
  const where = movementWhere(filters)
  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: movementInclude,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryMovement.count({ where }),
  ])
  res.json({
    rows: rows.map(row => ({ ...row, unitCost: row.unitCost === null ? null : Number(row.unitCost) })),
    total,
    page,
    pageSize,
  })
}))

inventoryRouter.get('/drafts', canManageInventory, asyncHandler(async (_req, res) => {
  const rows = await prisma.inventoryMovement.findMany({
    where: { status: 'DRAFT' },
    include: movementInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  })
  res.json(rows.map(row => ({ ...row, unitCost: row.unitCost === null ? null : Number(row.unitCost) })))
}))

inventoryRouter.get('/movements/export.csv', canReadInventory, asyncHandler(async (req, res) => {
  const parsed = parseFilters(req)
  if (!parsed.success) return res.status(400).json({ error: 'Filtros de exportación inválidos.' })
  const rows = await prisma.inventoryMovement.findMany({
    where: movementWhere(parsed.data),
    include: movementInclude,
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    take: 50001,
  })
  if (rows.length > 50000) return res.status(422).json({ error: 'La exportación supera 50 000 movimientos. Reduce el intervalo de fechas o filtra por producto.' })
  const quote = value => {
    const text = String(value ?? '')
    return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`
  }
  const header = ['fecha', 'producto', 'sku', 'tipo', 'direccion', 'cantidad', 'saldo', 'motivo', 'referencia', 'proveedor', 'costo_unitario', 'usuario', 'confirmado_por', 'reversion_de']
  const lines = rows.map(row => [
    row.occurredAt.toISOString(),
    row.product.name,
    row.product.sku,
    row.type,
    row.direction,
    row.quantity,
    row.balanceAfter,
    row.reason,
    row.reference,
    row.supplier,
    row.unitCost === null ? '' : Number(row.unitCost).toFixed(2),
    row.createdBy ? `${row.createdBy.nombre} ${row.createdBy.apellido}` : '',
    row.confirmedBy ? `${row.confirmedBy.nombre} ${row.confirmedBy.apellido}` : '',
    row.reversalOfId,
  ].map(quote).join(','))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="kardex-tecruta.csv"')
  res.send(`\uFEFF${[header.map(quote).join(','), ...lines].join('\r\n')}`)
}))

inventoryRouter.post('/movements', canManageInventory, asyncHandler(async (req, res) => {
  const parsed = inventoryDraftSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Movimiento inválido.' })
  const direction = movementDirection(parsed.data.type)
  const movement = await createDraftMovement(prisma, {
    ...parsed.data,
    direction,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
    createdById: req.user.id,
  })
  res.status(201).json(movement)
}))

inventoryRouter.post('/movements/:id/confirm', canManageInventory, asyncHandler(async (req, res) => {
  const movement = await confirmDraftMovement(prisma, req.params.id, req.user.id)
  res.json(movement)
}))

inventoryRouter.delete('/movements/:id', canManageInventory, asyncHandler(async (req, res) => {
  const deleted = await prisma.inventoryMovement.deleteMany({
    where: { id: req.params.id, status: 'DRAFT', ...(req.user.role === 'ADMIN' ? {} : { createdById: req.user.id }) },
  })
  if (!deleted.count) return res.status(404).json({ error: 'Borrador no encontrado o no editable.' })
  res.status(204).end()
}))

inventoryRouter.post('/movements/:id/reverse', canManageInventory, asyncHandler(async (req, res) => {
  const parsed = inventoryReversalSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Motivo de reversión inválido.' })
  res.status(201).json(await reverseMovement(prisma, req.params.id, req.user.id, parsed.data.reason))
}))

export { inventoryRouter }
