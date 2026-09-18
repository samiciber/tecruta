import jwt from 'jsonwebtoken'

const EXPIRES_IN = '30d'

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}