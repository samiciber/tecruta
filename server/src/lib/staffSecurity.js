import { randomBytes, createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { AuthError, hash, randomSecret } from './authSecurity.js'
import { signToken } from './token.js'
import { version } from './authCodes.js'
export const STAFF_ROLES = ['ADMIN', 'CASHIER', 'WAREHOUSE']
export const isStaff = user => STAFF_ROLES.includes(user?.role)
export const canRecover = user => user && !user.isSuspended && (user.role === 'CUSTOMER' || user.role === 'ADMIN' && user.ownerRecoveryEnabled)
export const audit = (tx, actorId, action, subjectId = null, detail = {}) => tx.staffAuditEvent.create({ data: { actorId, action, subjectId, detail } })
export async function revokeStaff(tx, user, data = {}) {
  await tx.staffSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  await tx.staffLoginChallenge.deleteMany({ where: { userId: user.id } })
  return tx.user.update({ where: { id: user.id }, data: { ...data, tokenVersion: version(user) + 1 } })
}
export async function panelSession(db, user) {
  const sid = randomSecret(), now = new Date()
  const expiresAt=new Date(Math.min(now.getTime()+12*3600000,user.temporaryPasswordExpiresAt?.getTime()??Infinity))
  await db.staffSession.create({ data: { tokenHash: hash(sid), userId: user.id, lastSeenAt: now, expiresAt } })
  return signToken({ sub: user.id, tokenVersion: version(user), authChannel: 'panel', sid })
}
export async function mfaChallenge(db, user) {
  const challenge = randomSecret(), now = new Date()
  await db.staffLoginChallenge.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { userId: user.id }] } })
  await db.staffLoginChallenge.create({ data: { tokenHash: hash(challenge), userId: user.id, tokenVersion: version(user), expiresAt: new Date(now.getTime() + 5 * 60000) } })
  return challenge
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32(bytes) {
  let bits = 0, value = 0, result = ''
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { bits -= 5; result += alphabet[(value >>> bits) & 31] } }
  if (bits) result += alphabet[(value << (5 - bits)) & 31]
  return result
}
function unbase32(value) {
  let bits = 0, acc = 0; const bytes = []
  for (const char of value) { acc = (acc << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { bits -= 8; bytes.push((acc >>> bits) & 255) } }
  return Buffer.from(bytes)
}
export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step))
  const digest = createHmac('sha1', unbase32(secret)).update(counter).digest(), offset = digest[19] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
export function acceptedStep(secret, code, lastStep = -1) {
  if (!/^\d{6}$/.test(code || '')) return null
  const current = Math.floor(Date.now() / 30000)
  for (const step of [current, current - 1, current + 1]) if (step > (lastStep ?? -1) && timingSafeEqual(Buffer.from(totp(secret, step)), Buffer.from(code))) return step
  return null
}
function key() {
  const bytes = Buffer.from(process.env.MFA_ENCRYPTION_KEY || '', 'base64')
  if (bytes.length !== 32) throw new AuthError(503, 'Configura MFA_ENCRYPTION_KEY de 32 bytes antes de activar o usar la aplicación autenticadora.')
  return bytes
}
export function encryptSecret(value) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}
export function decryptSecret(value) {
  const bytes = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0,12))
  decipher.setAuthTag(bytes.subarray(12,28))
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
}
export const recoveryHash = value => createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex')
export function verifyFactor(user, code) {
  let secret
  try {secret=decryptSecret(user.mfaSecretEncrypted)} catch(error) {if(error.status)throw error;throw new AuthError(503,'No se pudo verificar el segundo factor. Revisa la clave de cifrado del servidor.')}
  const step = acceptedStep(secret, code, user.mfaLastStep)
  if (step !== null) return { mfaLastStep: step }
  const hashes = Array.isArray(user.mfaRecoveryHashes) ? user.mfaRecoveryHashes : []
  const candidate = recoveryHash(code), index = hashes.indexOf(candidate)
  if (index < 0) return null
  return { mfaRecoveryHashes: hashes.filter((_, i) => i !== index) }
}
