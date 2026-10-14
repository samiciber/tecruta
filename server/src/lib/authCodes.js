import { CODE_TTL_MS, CODE_RESEND_MS, CODE_MAX_ATTEMPTS, generateCode, codeHash, equalHash } from './authSecurity.js'

const fields = purpose => {
  const prefix = purpose === 'verify' ? 'verificationCode' : 'resetCode'
  return { old: prefix, hash: prefix + 'Hash', expires: prefix + 'ExpiresAt', attempts: prefix + 'Attempts',
    locked: prefix + 'LockedUntil', sent: prefix + 'SentAt' }
}
export async function lockUser(tx, id) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`
  return tx.user.findUnique({ where: { id } })
}
export function version(user) { return user.tokenVersion ?? 0 }
export async function issueCode(tx, user, purpose, now) {
  const f = fields(purpose)
  if ((purpose === 'verify' && user.verified) || user[f.locked]?.getTime() > now.getTime()
    || user[f.sent]?.getTime() > now.getTime() - CODE_RESEND_MS) return null
  const expired = !user[f.expires] || user[f.expires].getTime() <= now.getTime()
  const unlocked = user[f.locked] && user[f.locked].getTime() <= now.getTime()
  const code = generateCode()
  await tx.user.update({ where: { id: user.id }, data: {
    [f.old]: null, [f.hash]: codeHash(user.id, purpose, code), [f.expires]: new Date(now.getTime() + CODE_TTL_MS),
    [f.attempts]: expired || unlocked ? 0 : user[f.attempts] ?? 0, [f.locked]: null, [f.sent]: now,
  } })
  return { to: user.email, code }
}
export async function consumeCode(tx, user, purpose, code, now) {
  const f = fields(purpose)
  if (!user || !user[f.hash] || !user[f.expires] || user[f.expires].getTime() <= now.getTime()
    || user[f.locked]?.getTime() > now.getTime() || (user[f.attempts] ?? 0) >= CODE_MAX_ATTEMPTS) return false
  if (!equalHash(user[f.hash], codeHash(user.id, purpose, code))) {
    const attempts = (user[f.attempts] ?? 0) + 1
    await tx.user.update({ where: { id: user.id }, data: {
      [f.attempts]: attempts,
      ...(attempts >= CODE_MAX_ATTEMPTS ? { [f.hash]: null, [f.expires]: null, [f.locked]: new Date(now.getTime() + CODE_TTL_MS) } : {}),
    } })
    return false
  }
  await tx.user.update({ where: { id: user.id }, data: {
    [f.old]: null, [f.hash]: null, [f.expires]: null, [f.attempts]: 0, [f.locked]: null,
  } })
  return true
}
