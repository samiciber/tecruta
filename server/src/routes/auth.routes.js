import { Router } from 'express'
import { authFrontendOrigin } from '../lib/runtimeConfig.js'
import { normalizeAdminUsername } from '../lib/adminUsername.js'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signSession } from '../lib/token.js'
import { serializeUser } from '../lib/serializers.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js'
import { buildGoogleAuthUrl, exchangeCodeForAccessToken, fetchGoogleProfile } from '../lib/google.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { createAuthMiddleware } from '../middleware/auth.js'
import { loginRateLimiter, authActionRateLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { registerSchema, emailOnlySchema, loginSchema, staffLoginSchema, verifySchema, resetPasswordSchema, changePasswordSchema, updateProfileSchema } from '../lib/schemas.js'
import { AuthError, UNIFORM_AUTH_RESPONSE, normalizeEmail, secret, challenge, signFlowCookie, readFlowCookie,
  oauthCookieName, oauthCookieOptions, randomSecret } from '../lib/authSecurity.js'
import { lockUser, version, issueCode, consumeCode } from '../lib/authCodes.js'
import { startGoogleFlow, consumeGoogleFlow, resolveGoogleUser, issueExchange, consumeExchange } from '../lib/oauthService.js'

const invalidCode = { error: 'El código no es válido o venció. Solicita uno nuevo; si agotaste los intentos, espera 15 minutos.' }
function dateValue(value) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new AuthError(400, 'Ingresa una fecha válida.')
  return date
}

export function createAuthRouter({ db = prisma, now = () => new Date(),
  mailer = { verification: sendVerificationEmail, reset: sendPasswordResetEmail },
  google = { authorizationUrl: buildGoogleAuthUrl, exchange: exchangeCodeForAccessToken, profile: fetchGoogleProfile } } = {}) {
  const router = Router()
  const dummyPasswordHash = bcrypt.hash(randomSecret(), 10)
  const { requireAuth } = createAuthMiddleware({ db })
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next() })
  const dispatch = (purpose, message) => {
    if (message) void Promise.resolve().then(() => mailer[purpose](message)).catch(() => {
      // Delivery state must not reveal whether an account exists.
      console.error('No se pudo enviar un correo de autenticación.')
    })
  }
  const lookupAndIssue = async (email, purpose) => db.$transaction(async tx => {
    const found = await tx.user.findUnique({ where: { email } })
    if (!found) return null
    const user = await lockUser(tx, found.id)
    return issueCode(tx, user, purpose, now())
  })

  router.post('/register', authActionRateLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
    secret()
    const email = normalizeEmail(req.body.email)
    const birthdate = dateValue(req.body.fechaNacimiento)
    // Perform the password work for both existing and new emails.
    const passwordHash = await bcrypt.hash(req.body.password, 10)
    const message = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-email:${email}`}, 0))`
      let user = await tx.user.findUnique({ where: { email } })
      if (user) user = await lockUser(tx, user.id)
      else user = await tx.user.create({ data: { email, passwordHash, nombre: req.body.nombre,
        apellido: req.body.apellido, fechaNacimiento: birthdate } })
      return issueCode(tx, user, 'verify', now())
    })
    dispatch('verification', message)
    res.status(202).json(UNIFORM_AUTH_RESPONSE)
  }))
  router.post('/resend-code', authActionRateLimiter, validate(emailOnlySchema), asyncHandler(async (req, res) => {
    secret()
    dispatch('verification', await lookupAndIssue(normalizeEmail(req.body.email), 'verify'))
    res.status(202).json(UNIFORM_AUTH_RESPONSE)
  }))
  router.post('/forgot-password', authActionRateLimiter, validate(emailOnlySchema), asyncHandler(async (req, res) => {
    secret()
    dispatch('reset', await lookupAndIssue(normalizeEmail(req.body.email), 'reset'))
    res.status(202).json(UNIFORM_AUTH_RESPONSE)
  }))
  router.post('/verify', loginRateLimiter, validate(verifySchema), asyncHandler(async (req, res) => {
    secret()
    const accepted = await db.$transaction(async tx => {
      const found = await tx.user.findUnique({ where: { email: normalizeEmail(req.body.email) } })
      if (!found) return false
      const user = await lockUser(tx, found.id)
      if (!await consumeCode(tx, user, 'verify', req.body.code, now())) return false
      await tx.user.update({ where: { id: user.id }, data: { verified: true } })
      return true
    })
    return accepted ? res.json({ ok: true }) : res.status(400).json(invalidCode)
  }))
  router.post('/reset-password', loginRateLimiter, validate(resetPasswordSchema), asyncHandler(async (req, res) => {
    secret()
    const passwordHash = await bcrypt.hash(req.body.newPassword, 10)
    const accepted = await db.$transaction(async tx => {
      const found = await tx.user.findUnique({ where: { email: normalizeEmail(req.body.email) } })
      if (!found) return false
      const user = await lockUser(tx, found.id)
      if (!await consumeCode(tx, user, 'reset', req.body.code, now())) return false
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: version(user) + 1,
        verified: true, resetCode: null, verificationCode: null, verificationCodeHash: null,
        verificationCodeExpiresAt: null, verificationCodeAttempts: 0, verificationCodeLockedUntil: null } })
      return true
    })
    return accepted ? res.json({ ok: true }) : res.status(400).json(invalidCode)
  }))
  router.post('/login', loginRateLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
    secret()
    const user = await db.user.findUnique({ where: { email: normalizeEmail(req.body.email) } })
    const matches = await bcrypt.compare(req.body.password, user?.passwordHash ?? await dummyPasswordHash)
    if (!user || !matches) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' })
    if (!user.verified) return res.status(403).json({ error: 'Debes verificar tu correo antes de iniciar sesión.', needsVerification: true })
    res.json({ token: signSession(user), user: serializeUser(user) })
  }))
  router.get('/me', requireAuth, (req, res) => res.json({ user: serializeUser(req.user) }))
  router.post('/staff-login', loginRateLimiter, validate(staffLoginSchema), asyncHandler(async (req, res) => {
    secret()
    const identifier = normalizeEmail(req.body.identifier)
    let where
    if (identifier.includes('@')) where = { email: identifier }
    else { try { where = { adminUsername: normalizeAdminUsername(identifier) } } catch {} }
    const user = where ? await db.user.findUnique({ where }) : null
    const matches = await bcrypt.compare(req.body.password, user?.passwordHash ?? await dummyPasswordHash)
    // Uniform response for unknown alias/email, invalid password and non-ADMIN.
    if (!user || !matches || !user.verified || user.role !== 'ADMIN') return res.status(401).json({ error: 'Usuario, correo o contraseña incorrectos, o acceso no autorizado.' })
    res.json({ token: signSession(user), user: serializeUser(user) })
  }))
  router.patch('/me', requireAuth, validate(updateProfileSchema), asyncHandler(async (req, res) => {
    const { nombre, apellido, fechaNacimiento } = req.body
    const user = await db.user.update({ where: { id: req.user.id }, data: {
      ...(nombre !== undefined ? { nombre } : {}), ...(apellido !== undefined ? { apellido } : {}),
      ...(fechaNacimiento !== undefined ? { fechaNacimiento: dateValue(fechaNacimiento) } : {}),
    } })
    res.json({ user: serializeUser(user) })
  }))
  router.post('/change-password', requireAuth, loginRateLimiter, validate(changePasswordSchema), asyncHandler(async (req, res) => {
    await db.$transaction(async tx => {
      const user = await lockUser(tx, req.user.id)
      if (version(user) !== version(req.user)) throw new AuthError(401, 'La sesión cambió. Inicia sesión nuevamente.')
      if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash)) throw new AuthError(400, 'La contraseña actual no es correcta.')
      const passwordHash = await bcrypt.hash(req.body.newPassword, 10)
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: version(user) + 1,
        resetCode: null, resetCodeHash: null, resetCodeExpiresAt: null, resetCodeAttempts: 0, resetCodeLockedUntil: null } })
    })
    res.json({ ok: true })
  }))
  router.post('/logout-all', requireAuth, authActionRateLimiter, asyncHandler(async (req, res) => {
    await db.$transaction(async tx => {
      const user = await lockUser(tx, req.user.id)
      if (version(user) !== version(req.user)) throw new AuthError(401, 'La sesión ya cambió.')
      await tx.user.update({ where: { id: user.id }, data: { tokenVersion: version(user) + 1 } })
    })
    res.json({ ok: true })
  }))

  router.get('/google', authActionRateLimiter, asyncHandler(async (req, res) => {
    const audience = req.query.app ?? 'store'
    if (!['store', 'panel'].includes(audience)) return res.status(400).json({ error: 'Destino OAuth no permitido.' })
    let origin
    try { origin = authFrontendOrigin(audience) }
    catch { return res.status(503).json({ error: 'El acceso con Google no está configurado para este destino.' }) }
    try {
      secret()
      const flow = await startGoogleFlow(db, req.query.challenge, now())
      const destination = google.authorizationUrl(flow.state, challenge(flow.verifier))
      res.cookie(oauthCookieName(), signFlowCookie({ stateHash: flow.stateHash, binding: flow.binding, verifier: flow.verifier, audience }), oauthCookieOptions())
      res.redirect(destination)
    } catch (error) {
      if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message })
      res.redirect(`${origin}/iniciar-sesion?googleError=config`)
    }
  }))
  router.get('/google/callback', asyncHandler(async (req, res) => {
    const cookie = readFlowCookie(req.headers.cookie)
    const audience = cookie?.audience ?? 'store'
    let origin
    try { origin = authFrontendOrigin(audience) }
    catch { return res.status(503).json({ error: 'El acceso con Google no está configurado para este destino.' }) }
    const fail = reason => res.redirect(`${origin}/iniciar-sesion?googleError=${reason}`)
    const { maxAge: _maxAge, ...cookieOptions } = oauthCookieOptions()
    res.clearCookie(oauthCookieName(), cookieOptions)
    let flow
    try { flow = await consumeGoogleFlow(db, req.query.state, cookie, now()) }
    catch (error) {
      if (error.status === 400) return fail('state')
      return fail('unavailable')
    }
    if (req.query.error) return fail('denied')
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) return fail('invalid')
    let profile
    try { profile = await google.profile(await google.exchange(req.query.code, flow.verifier)) }
    catch { return fail('exchange') }
    try {
      const user = await resolveGoogleUser(db, profile, { adminOnly: audience === 'panel' })
      const code = await issueExchange(db, user, flow.exchangeChallenge, now(), audience)
      res.redirect(`${origin}/auth/google/callback?code=${encodeURIComponent(code)}`)
    } catch (error) { return fail(error.status === 403 ? (audience === 'panel' ? 'access' : 'linking') : 'unavailable') }
  }))
  router.post('/google/exchange', loginRateLimiter, asyncHandler(async (req, res) => {
    secret()
    const user = await consumeExchange(db, req.body?.code, req.body?.verifier, now())
    res.json({ token: signSession(user), user: serializeUser(user) })
  }))
  router.post('/staff-google/exchange', loginRateLimiter, asyncHandler(async (req, res) => {
    secret()
    const user = await consumeExchange(db, req.body?.code, req.body?.verifier, now(), 'panel')
    res.json({ token: signSession(user), user: serializeUser(user) })
  }))
  return router
}
export const authRouter = createAuthRouter()
