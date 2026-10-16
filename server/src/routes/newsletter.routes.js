import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

export const subscriptionSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)), consent: z.literal(true, { error: 'Debes aceptar la suscripción y leer la privacidad.' }) })
export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[\s]*[=+\-@\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function createNewsletterRouter({ db = prisma, authenticate = requireAuth, limit = 5 } = {}) {
  const router = Router()
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' } })
  router.post('/newsletter/subscribe', limiter, asyncHandler(async (req, res) => {
    const parsed = subscriptionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Revisa el correo y acepta la suscripción.' })
    try { await db.newsletterSubscriber.create({ data: { email: parsed.data.email } }) }
    catch (error) { if (error.code === 'P2002') return res.status(409).json({ error: 'Este correo ya está suscrito.' }); throw error }
    res.status(201).json({ ok: true })
  }))
  router.get('/admin/newsletter/subscribers', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const parsed = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }).safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Página inválida.' })
    const page = parsed.data.page
    const [items, total] = await Promise.all([db.newsletterSubscriber.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50, select: { id: true, email: true, createdAt: true } }), db.newsletterSubscriber.count()])
    res.json({ items, total, page, pageSize: 50 })
  }))
  router.get('/admin/newsletter/export.csv', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
    let cursor
    // Obtain the first batch before sending success headers, so DB errors stay errors.
    const load = () => db.newsletterSubscriber.findMany({ orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, email: true, createdAt: true } })
    let rows = await load()
    res.set({ 'Cache-Control': 'no-store', 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"' })
    res.write('\uFEFFcorreo,fecha_registro\r\n')
    try {
      while (rows.length) {
        for (const row of rows) {
          if (res.destroyed) return
          if (!res.write(`${csvCell(row.email)},${csvCell(row.createdAt.toISOString())}\r\n`)) await new Promise(resolve => {
            const done = () => { res.off('drain', done); res.off('close', done); resolve() }
            res.once('drain', done); res.once('close', done)
          })
        }
        if (res.destroyed) return
        if (rows.length < 500) break
        cursor = rows.at(-1).id; rows = await load()
      }
      res.end()
    } catch { res.destroy() } // A partial export must fail as a download, never as successful JSON.
  }))
  return router
}
export const newsletterRouter = createNewsletterRouter()
