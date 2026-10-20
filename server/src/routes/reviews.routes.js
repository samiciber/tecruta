import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createAuthMiddleware, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { reviewCreateSchema, reviewModerateSchema, reviewQuerySchema } from '../lib/reviewSchemas.js'
import { createReview, moderateReview, voteReviewHelpful, reviewEligibility, listPublicReviews, publicReview, publicAuthor } from '../lib/reviewService.js'

export const reviewWriteLimiter = rateLimit({ windowMs: 15 * 60000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos antes de continuar.' } })
const query = schema => (req,res,next) => { const result = schema.safeParse(req.query); if (!result.success) return res.status(400).json({error:'Filtros inválidos.'}); req.reviewQuery = result.data; next() }
export function createReviewsRouter({ db = prisma } = {}) {
  const router = Router(), { requireAuth } = createAuthMiddleware({ db })
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next() })
  router.get('/recent', asyncHandler(async (_req,res) => {
    const rows = await db.productReview.findMany({ where: { status: 'APPROVED' }, take: 6, orderBy: [{createdAt:'desc'},{id:'desc'}], include: { user: publicAuthor, product: { select: { name:true,slug:true } } } })
    res.json({ items: rows.length >= 3 ? rows.map(row => ({...publicReview(row),product:row.product})) : [] })
  }))
  router.get('/products/:productId', query(reviewQuerySchema), asyncHandler(async (req,res) => res.json(await listPublicReviews(db,req.params.productId,req.reviewQuery))))
  router.get('/products/:productId/eligibility', requireAuth, asyncHandler(async (req,res) => res.json(await reviewEligibility(db,req.params.productId,req.user))))
  router.post('/products/:productId', requireAuth, requireRole('CUSTOMER'), reviewWriteLimiter, validate(reviewCreateSchema), asyncHandler(async (req,res) => res.status(201).json(await createReview(db,req.params.productId,req.user.id,req.body))))
  router.post('/:id/helpful', requireAuth, requireRole('CUSTOMER'), reviewWriteLimiter, asyncHandler(async (req,res) => res.json(await voteReviewHelpful(db,req.params.id,req.user.id))))
  return router
}
export function createReviewAdminRouter({ db = prisma } = {}) {
  const router = Router(), { requireAuth } = createAuthMiddleware({ db })
  router.use(requireAuth,requireRole('ADMIN'),(_req,res,next) => { res.set('Cache-Control','no-store'); next() })
  router.get('/', query(z.object({ status:z.enum(['PENDING','APPROVED','REJECTED']).default('PENDING'), before:z.string().datetime().optional(), cursor:z.string().max(100).optional() })), asyncHandler(async (req,res) => {
    const { status,before,cursor } = req.reviewQuery
    const rows = await db.productReview.findMany({where:{status,...(before ? {OR:[{createdAt:{lt:new Date(before)}},{createdAt:new Date(before),id:{lt:cursor||''}}]} : {})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:31,
      include:{user:publicAuthor,product:{select:{name:true,slug:true}}}})
    const items=rows.slice(0,30),last=items.at(-1)
    res.json({items:items.map(row=>({...publicReview(row),product:row.product,status:row.status,rejectionReason:row.rejectionReason,moderatedAt:row.moderatedAt})),next:rows.length>30?{before:last.createdAt.toISOString(),cursor:last.id}:null})
  }))
  router.patch('/:id',reviewWriteLimiter,validate(reviewModerateSchema),asyncHandler(async(req,res)=>res.json(await moderateReview(db,req.params.id,req.user.id,req.body))))
  return router
}
export const reviewsRouter = createReviewsRouter()
export const reviewAdminRouter = createReviewAdminRouter()
