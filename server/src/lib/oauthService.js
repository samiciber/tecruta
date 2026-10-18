import bcrypt from 'bcryptjs'
import { AuthError, OAUTH_TTL_MS, EXCHANGE_TTL_MS, randomSecret, hash, challenge, equalHash, googleIdentity, validProof } from './authSecurity.js'
import { lockUser, version } from './authCodes.js'

export async function startGoogleFlow(db, exchangeChallenge, now) {
  if (!validProof(exchangeChallenge)) throw new AuthError(400, 'Falta iniciar Google desde esta pestaña.')
  const state = randomSecret()
  const binding = randomSecret()
  const verifier = randomSecret()
  await db.oAuthFlow.deleteMany({ where: { expiresAt: { lte: now } } })
  await db.authExchange.deleteMany({ where: { expiresAt: { lte: now } } })
  await db.oAuthFlow.create({ data: { stateHash: hash(state), bindingHash: hash(binding), exchangeChallenge,
    expiresAt: new Date(now.getTime() + OAUTH_TTL_MS) } })
  return { state, binding, verifier, stateHash: hash(state) }
}
export async function consumeGoogleFlow(db, state, cookie, now) {
  if (!validProof(state) || !cookie || !equalHash(hash(state), cookie.stateHash)) throw new AuthError(400, 'La sesión de Google no es válida.')
  return db.$transaction(async tx => {
    const flow = await tx.oAuthFlow.findUnique({ where: { stateHash: hash(state) } })
    if (!flow || flow.expiresAt <= now || !equalHash(flow.bindingHash, hash(cookie.binding))) throw new AuthError(400, 'La sesión de Google no es válida.')
    const consumed = await tx.oAuthFlow.deleteMany({ where: { id: flow.id, bindingHash: hash(cookie.binding), expiresAt: { gt: now } } })
    if (consumed.count !== 1) throw new AuthError(400, 'La sesión de Google ya fue usada.')
    return { ...flow, verifier: cookie.verifier }
  })
}
export async function resolveGoogleUser(db, profile, { adminOnly = false } = {}) {
  const identity = googleIdentity(profile)
  // Hash on all successful Google profiles, not only new emails.
  const passwordHash = await bcrypt.hash(randomSecret(), 10)
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`google-sub:${identity.sub}`}, 0))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-email:${identity.email}`}, 0))`
    let user = await tx.user.findUnique({ where: { googleId: identity.sub } })
    if (user) {
      user = await lockUser(tx, user.id)
      if (adminOnly && user.role !== 'ADMIN') throw new AuthError(403, 'Acceso al panel no autorizado.')
      if (!user.verified) throw new AuthError(403, 'Verifica o recupera primero tu cuenta local.')
      return user
    }
    user = await tx.user.findUnique({ where: { email: identity.email } })
    if (user) {
      user = await lockUser(tx, user.id)
      if (adminOnly && user.role !== 'ADMIN') throw new AuthError(403, 'Acceso al panel no autorizado.')
      // Never verify a local account or replace another Google identity here.
      if (!user.verified || (user.googleId && user.googleId !== identity.sub)) throw new AuthError(403, 'Verifica o recupera primero tu cuenta local.')
      return tx.user.update({ where: { id: user.id }, data: { googleId: identity.sub } })
    }
    if (adminOnly) throw new AuthError(403, 'Acceso al panel no autorizado.')
    return tx.user.create({ data: { email: identity.email, passwordHash, googleId: identity.sub, verified: true,
      nombre: typeof profile.given_name === 'string' && profile.given_name.trim() || 'Cliente',
      apellido: typeof profile.family_name === 'string' ? profile.family_name.trim() : '' } })
  })
}
function scopedChallenge(value, audience) { return audience === 'panel' ? challenge(`panel:${value}`) : value }
export async function issueExchange(db, user, exchangeChallenge, now, audience = 'store') {
  const code = randomSecret()
  await db.authExchange.create({ data: { codeHash: hash(code), userId: user.id, tokenVersion: version(user),
    exchangeChallenge: scopedChallenge(exchangeChallenge, audience), expiresAt: new Date(now.getTime() + EXCHANGE_TTL_MS) } })
  return code
}
export async function consumeExchange(db, code, verifier, now, audience = 'store') {
  if (!validProof(code) || !validProof(verifier)) throw new AuthError(401, 'El acceso de Google venció o no es válido. Inícialo nuevamente.')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM auth_exchanges WHERE "codeHash" = ${hash(code)} FOR UPDATE`
    const exchange = await tx.authExchange.findUnique({ where: { codeHash: hash(code) } })
    if (!exchange || exchange.expiresAt <= now || !equalHash(hash(exchange.exchangeChallenge), hash(scopedChallenge(challenge(verifier), audience)))) {
      throw new AuthError(401, 'El acceso de Google venció o no es válido. Inícialo nuevamente.')
    }
    const user = await lockUser(tx, exchange.userId)
    if (!user || !user.verified || version(user) !== exchange.tokenVersion) throw new AuthError(401, 'El acceso de Google venció o no es válido. Inícialo nuevamente.')
    if (audience === 'panel' && user.role !== 'ADMIN') throw new AuthError(403, 'Acceso al panel no autorizado.')
    await tx.authExchange.delete({ where: { id: exchange.id } })
    return user
  })
}
