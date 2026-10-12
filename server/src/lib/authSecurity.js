import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'

export const CODE_TTL_MS = 15 * 60 * 1000
export const CODE_MAX_ATTEMPTS = 5
export const CODE_RESEND_MS = 60 * 1000
export const OAUTH_TTL_MS = 5 * 60 * 1000
export const EXCHANGE_TTL_MS = 60 * 1000
export const UNIFORM_AUTH_RESPONSE = Object.freeze({ ok: true, message: 'Si corresponde, enviaremos instrucciones al correo indicado. Revisa también spam.' })
export class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export function normalizeEmail(value) { return String(value || '').trim().toLowerCase() }
export function secret() {
  if (!process.env.JWT_SECRET) throw new AuthError(503, 'La autenticación no está disponible en este momento.')
  return process.env.JWT_SECRET
}
export function randomSecret() { return randomBytes(32).toString('base64url') }
export function hash(value) { return createHash('sha256').update(value).digest('hex') }
export function challenge(value) { return createHash('sha256').update(value).digest('base64url') }
export function generateCode() { return String(randomInt(0, 1000000)).padStart(6, '0') }
export function codeHash(userId, purpose, code) {
  return createHmac('sha256', secret()).update(JSON.stringify(['tecruta:auth-code:v1', userId, purpose, code])).digest('hex')
}
export function equalHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}
export function validProof(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) }
export function oauthCookieOptions() {
  const secure = process.env.NODE_ENV === 'production' || process.env.GOOGLE_CALLBACK_URL?.startsWith('https://')
  return { httpOnly: true, secure: Boolean(secure), sameSite: 'lax', path: '/', maxAge: OAUTH_TTL_MS }
}
export function oauthCookieName() { return oauthCookieOptions().secure ? '__Host-tecruta-oauth' : 'tecruta-oauth' }
export function signFlowCookie(payload) {
  return jwt.sign({ ...payload, purpose: 'tecruta:google-flow:v1' }, secret(), { algorithm: 'HS256', expiresIn: '5m' })
}
export function readFlowCookie(header) {
  try {
    const name = oauthCookieName() + '='
    const values = String(header || '').split(';').map(part => part.trim()).filter(part => part.startsWith(name))
    if (values.length !== 1) return null
    const payload = jwt.verify(decodeURIComponent(values[0].slice(name.length)), secret(), { algorithms: ['HS256'] })
    if (payload.purpose !== 'tecruta:google-flow:v1' || !validProof(payload.binding) || !validProof(payload.verifier) || typeof payload.stateHash !== 'string') return null
    return payload
  } catch { return null }
}
export function googleIdentity(profile) {
  if (typeof profile?.sub !== 'string' || !profile.sub.trim() || profile.sub.length > 255 || profile.email_verified !== true
    || typeof profile.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(profile.email))) {
    throw new AuthError(403, 'Google no confirmó una identidad con correo verificado.')
  }
  return { sub: profile.sub, email: normalizeEmail(profile.email) }
}
