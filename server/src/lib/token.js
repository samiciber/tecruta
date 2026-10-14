import jwt from 'jsonwebtoken'
import { secret } from './authSecurity.js'

const EXPIRES_IN = '30d'

export function signToken(payload) {
  return jwt.sign(payload, secret(), { expiresIn: EXPIRES_IN })
}

export function verifyToken(token) {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] })
}

export function signSession(user) {
  return signToken({ sub: user.id, tokenVersion: user.tokenVersion ?? 0 })
}
