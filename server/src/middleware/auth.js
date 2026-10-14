import { verifyToken } from '../lib/token.js'
import { prisma } from '../lib/prisma.js'

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
      if (!user || tokenVersion !== (user.tokenVersion ?? 0)) return res.status(401).json({ error: 'Sesión inválida o expirada.' })
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

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' })
    next()
  }
}
