import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createAuthMiddleware, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { authActionRateLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { serializeUser } from '../lib/serializers.js'
import { issueCode, lockUser, version } from '../lib/authCodes.js'
import { AuthError, normalizeEmail, randomSecret } from '../lib/authSecurity.js'
import { sendStaffActivationEmail } from '../lib/mailer.js'
import { panelOrigin } from '../lib/runtimeConfig.js'

const role = z.enum(['ADMIN', 'CASHIER', 'WAREHOUSE'])
const invitation = z.object({ email: z.string().trim().email().max(254), nombre: z.string().trim().min(1).max(100), apellido: z.string().trim().min(1).max(100), role }).strict()
const assignment = z.object({ role: z.enum(['ADMIN', 'CASHIER', 'WAREHOUSE', 'CUSTOMER']) }).strict()
export function createStaffRouter({ db = prisma, mailer = sendStaffActivationEmail, now = () => new Date() } = {}) {
  const router = Router()
  const { requireAuth } = createAuthMiddleware({ db })
  router.use(requireAuth, requireRole('ADMIN'))
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  // Role changes are serialized, including their actor check. No schema changes
  // are needed: CUSTOMER revokes panel access while retaining business history.
  async function actor(tx, requestUser) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('tecruta:staff-access', 0))`
    const fresh = await lockUser(tx, requestUser.id)
    if (!fresh || fresh.role !== 'ADMIN' || version(fresh) !== version(requestUser)) throw new AuthError(403, 'Tu autorización cambió. Inicia sesión nuevamente.')
  }
  function checkMail() {
    if (mailer === sendStaffActivationEmail && (!process.env.RESEND_API_KEY || process.env.NODE_ENV === 'production' && !process.env.PANEL_ORIGIN)) throw new AuthError(503, 'Configura el correo transaccional y PANEL_ORIGIN antes de invitar trabajadores.')
  }
  async function deliver(message) {
    if (!message) throw new AuthError(429, 'Espera un minuto o hasta que termine el bloqueo antes de reenviar la activación.')
    try { await mailer({ ...message, activationUrl: panelOrigin() + '/recuperar-contrasena' }); return 'SENT' }
    catch { return 'FAILED' }
  }
  router.get('/', asyncHandler(async (_req, res) => {
    const rows = await db.user.findMany({ where: { role: { in: ['ADMIN', 'CASHIER', 'WAREHOUSE'] } }, orderBy: { createdAt: 'desc' } })
    res.json(rows.map(serializeUser))
  }))
  router.post('/', authActionRateLimiter, validate(invitation), asyncHandler(async (req, res) => {
    checkMail()
    const email = normalizeEmail(req.body.email), passwordHash = await bcrypt.hash(randomSecret(), 10)
    const result = await db.$transaction(async tx => {
      await actor(tx, req.user)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-email:${email}`}, 0))`
      if (await tx.user.findUnique({ where: { email } })) throw new AuthError(409, 'Ya existe una cuenta con ese correo. Asigna su rol desde Clientes; no se crea otra cuenta.')
      const user = await tx.user.create({ data: { email, passwordHash, nombre: req.body.nombre, apellido: req.body.apellido, role: req.body.role, verified: false } })
      return { user, message: await issueCode(tx, user, 'reset', now()) }
    })
    res.status(201).json({ user: serializeUser(result.user), delivery: await deliver(result.message) })
  }))
  router.post('/:id/activation', authActionRateLimiter, asyncHandler(async (req, res) => {
    checkMail()
    const message = await db.$transaction(async tx => {
      await actor(tx, req.user)
      const user = await lockUser(tx, req.params.id)
      if (!user || user.role === 'CUSTOMER') throw new AuthError(404, 'Trabajador no encontrado.')
      if (user.verified) throw new AuthError(409, 'La cuenta ya está activada. El titular puede recuperar su contraseña desde el login.')
      return issueCode(tx, user, 'reset', now())
    })
    res.json({ delivery: await deliver(message) })
  }))
  router.patch('/:id/role', authActionRateLimiter, validate(assignment), asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw new AuthError(409, 'No puedes cambiar tu propio acceso. Otro administrador debe hacerlo.')
    const user = await db.$transaction(async tx => {
      await actor(tx, req.user)
      const target = await lockUser(tx, req.params.id)
      if (!target) throw new AuthError(404, 'Usuario no encontrado.')
      if (target.role === req.body.role) return target
      if (await tx.cashSession.count({ where: { userId: target.id, status: 'OPEN' } })) throw new AuthError(409, 'El trabajador debe cerrar su turno de caja antes de cambiar su acceso.')
      return tx.user.update({ where: { id: target.id }, data: { role: req.body.role, tokenVersion: version(target) + 1 } })
    })
    res.json(serializeUser(user))
  }))
  return router
}
export const staffRouter = createStaffRouter()
