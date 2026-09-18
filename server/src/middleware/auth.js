import { verifyToken } from '../lib/token.js'
import { prisma } from '../lib/prisma.js'

// Protege una ruta: exige un header "Authorization: Bearer <token>" válido
// y adjunta el usuario correspondiente en req.user.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'No autenticado.' })
  }

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) return res.status(401).json({ error: 'No autenticado.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' })
  }
}

// Para uso futuro (Fase 4, endpoints de administración): exige que el
// usuario autenticado tenga el rol indicado.
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' })
    }
    next()
  }
}

// Para rutas que aceptan tanto clientes con sesión como invitados (por
// ejemplo, crear un pedido): si viene un token válido, adjunta el
// usuario; si no viene token o es inválido, sigue igual pero sin usuario
// (nunca bloquea la request).
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next()

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (user) req.user = user
  } catch {
    // Token inválido o expirado: seguimos como invitado, sin bloquear.
  }
  next()
}