import { verifyToken } from '../lib/token.js'
import { prisma } from '../lib/prisma.js'
import { hash } from '../lib/authSecurity.js'

export function createAuthMiddleware({ db = prisma, verify = verifyToken } = {}) {
  const authenticate = optional => async (req, res, next) => {
    const header = req.headers.authorization || ''
    if (!header && optional) return next()
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'No autenticado.' })
    let payload
    try {
      payload = verify(token)
    } catch (error) {
      if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return next(error)
      return res.status(401).json({ error: 'Sesión inválida o expirada.' })
    }
    // Legacy JWTs are version 0 until the first explicit revocation.
    const tokenVersion = payload?.tokenVersion ?? 0
    if (typeof payload?.sub !== 'string' || !payload.sub || !Number.isInteger(tokenVersion) || tokenVersion < 0) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' })
    }
    try {
      const user = await db.user.findUnique({ where: { id: payload.sub } })
      if (!user || user.isSuspended || tokenVersion !== (user.tokenVersion ?? 0)) return res.status(401).json({ error: 'Sesión inválida o expirada.' })
      req.authChannel = payload.authChannel || 'legacy'
      if (req.authChannel === 'panel') {
        if (typeof payload.sid !== 'string') return res.status(401).json({error:'Sesión inválida.'})
        const session = await db.staffSession.findUnique({where:{tokenHash:hash(payload.sid)}}), now = new Date()
        if (!session || session.userId !== user.id || session.revokedAt || session.expiresAt <= now || now - session.lastSeenAt > 30 * 60000) return res.status(401).json({error:'La sesión del personal venció. Inicia nuevamente.'})
        if (now - session.lastSeenAt > 60000) await db.staffSession.update({where:{id:session.id},data:{lastSeenAt:now}})
      }
      const path = req.originalUrl.split('?')[0]
      if (user.mustChangePassword && !((req.method === 'GET' && path === '/api/auth/me') || ['/api/auth/staff-change-password','/api/auth/logout-all'].includes(path))) return res.status(403).json({error:'Debes cambiar tu contraseña temporal antes de continuar.',code:'PASSWORD_CHANGE_REQUIRED'})
      req.user = user
      return next()
    } catch (error) {
      // Database/network errors remain 5xx, never an invalid-session response.
      return next(error)
    }
  }
  return { requireAuth: authenticate(false), optionalAuth: authenticate(true) }
}
export const { requireAuth, optionalAuth } = createAuthMiddleware()

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' })
    next()
  }
}
