import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { validate } from '../middleware/validate.js'
import { cashEntrySchema, closeCashSchema, confirmSaleSchema, openCashSchema, posSearchSchema, refundSchema, reportSchema, saleSchema, cancelSaleSchema } from '../lib/posSchemas.js'
import { cancelPendingSale, cashBalance, closeCash, reconcileSuspendedCash, confirmSale, createSale, manualCash, openCash, paymentConfiguration, refundSale, saleInclude } from '../lib/posService.js'
import { posReport, reportCsv } from '../lib/posReports.js'
import { fiscalGateway } from '../lib/fiscalGateway.js'
import { amount } from '../../../src/utils/posMoney.js'

export function createPosRouter({ db = prisma } = {}) {
  const router = Router()
  router.use(requireAuth, requireRole('ADMIN', 'CASHIER'))
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
  router.get('/config', asyncHandler(async (_req, res) => res.json(await paymentConfiguration(db))))
  router.put('/config', requireRole('ADMIN'), validate(z.strictObject({ allowMixed: z.boolean() })), asyncHandler(async (req, res) => {
    const setting = await db.siteSetting.upsert({ where: { key: 'posConfig' }, create: { key: 'posConfig', value: req.body }, update: { value: req.body } })
    res.json(setting.value)
  }))
  router.get('/products', asyncHandler(async (req, res) => {
    const parsed = posSearchSchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Busca al menos dos caracteres.' })
    const q = parsed.data.q
    // GIN pg_trgm + índices únicos de SKU/código. Sólo DTO de venta, máximo 20.
    const rows = await db.product.findMany({ where: { OR: [
      { name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q.toUpperCase() } },
      { barcodes: { some: { normalizedCode: { contains: q.toUpperCase() } } } },
    ] }, select: { id: true, name: true, sku: true, price: true, stock: true }, orderBy: { name: 'asc' }, take: 20 })
    res.json(rows)
  }))
  router.get('/cash', asyncHandler(async (req, res) => {
    const rows = await db.cashSession.findMany({ where: req.user.role === 'ADMIN' ? {} : { userId: req.user.id }, orderBy: { openedAt: 'desc' }, take: 100 })
    const sessions = await Promise.all(rows.map(async session => ({ ...session, currentExpected: session.expectedAmount?.toString() ?? amount(await cashBalance(db, session)) })))
    res.json(sessions)
  }))
  router.get('/cash/:id/entries', asyncHandler(async (req, res) => {
    const session = await db.cashSession.findUnique({ where: { id: req.params.id } })
    if (!session || (req.user.role !== 'ADMIN' && session.userId !== req.user.id)) return res.status(404).json({ error: 'Caja no encontrada.' })
    res.json(await db.cashEntry.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'asc' }, take: 1000 }))
  }))
  router.post('/cash', validate(openCashSchema), asyncHandler(async (req, res) => res.json(await openCash(db, req.user, req.body))))
  router.post('/cash/:id/entries', requireRole('ADMIN'), validate(cashEntrySchema), asyncHandler(async (req, res) => res.json(await manualCash(db, req.user, req.params.id, req.body))))
  router.post('/cash/:id/close', validate(closeCashSchema), asyncHandler(async (req, res) => res.json(await closeCash(db, req.user, req.params.id, req.body))))
  router.post('/cash/:id/reconcile',requireRole('ADMIN'),validate(closeCashSchema),asyncHandler(async(req,res)=>res.json(await reconcileSuspendedCash(db,req.user,req.params.id,req.body))))
  router.get('/web-orders', asyncHandler(async(req,res)=>{
    const page = Math.max(1,Math.min(10000,Number(req.query.page)||1))
    const where = {status:{in:['PENDING','CONFIRMED']},posSale:{is:null}}
    const [items,total] = await Promise.all([db.order.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:20,skip:(page-1)*20,select:{id:true,status:true,total:true,customerNombre:true,customerApellido:true,createdAt:true}}),db.order.count({where})])
    res.json({items,total,page})
  }))
  router.get('/web-orders/:id', asyncHandler(async (req, res) => {
    const order = await db.order.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, total: true, customerNombre: true, customerApellido: true, posSale: { select: { id: true, status: true } }, items: { select: { productId: true, name: true, quantity: true, unitPrice: true } } } })
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' })
    res.json(order)
  }))
  router.get('/sales', asyncHandler(async (req, res) => res.json(await db.posSale.findMany({ where: req.user.role === 'ADMIN' ? {} : { userId: req.user.id }, include: saleInclude, orderBy: { createdAt: 'desc' }, take: 100 }))))
  router.get('/sales/:id', asyncHandler(async (req, res) => {
    const sale = await db.posSale.findUnique({ where: { id: req.params.id }, include: saleInclude })
    if (!sale || (req.user.role !== 'ADMIN' && sale.userId !== req.user.id)) return res.status(404).json({ error: 'Venta no encontrada.' })
    res.json(sale)
  }))
  router.post('/sales', validate(saleSchema), asyncHandler(async (req, res) => res.json(await createSale(db, req.user, req.body))))
  router.post('/sales/:id/confirm', validate(confirmSaleSchema), asyncHandler(async (req, res) => res.json(await confirmSale(db, req.user, req.params.id, req.body))))
  router.post('/sales/:id/cancel', validate(cancelSaleSchema), asyncHandler(async (req, res) => res.json(await cancelPendingSale(db, req.user, req.params.id, req.body))))
  router.post('/sales/:id/refunds', requireRole('ADMIN'), validate(refundSchema), asyncHandler(async (req, res) => res.json(await refundSale(db, req.user, req.params.id, req.body))))
  for (const csv of [false, true]) router.get(csv ? '/reports/export.csv' : '/reports', asyncHandler(async (req, res) => {
    const parsed = reportSchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Filtros de reporte inválidos.' })
    const report = await posReport(db, req.user, parsed.data)
    if (!csv) return res.json(report)
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="pos-${parsed.data.type}.csv"`).send(reportCsv(report))
  }))
  router.get('/fiscal', asyncHandler(async (_req, res) => res.json(fiscalGateway.status())))
  router.post('/sales/:id/fiscal', requireRole('ADMIN'), asyncHandler(async (_req, res) => res.json(await fiscalGateway.issue({}))))
  return router
}
export const posRouter = createPosRouter()
