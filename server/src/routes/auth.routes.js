import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signToken } from '../lib/token.js'
import { serializeUser } from '../lib/serializers.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js'
import { buildGoogleAuthUrl, exchangeCodeForAccessToken, fetchGoogleProfile } from '../lib/google.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { loginRateLimiter, authActionRateLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import {
  registerSchema,
  emailOnlySchema,
  loginSchema,
  verifySchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../lib/schemas.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

// POST /api/auth/register
authRouter.post(
  '/register',
  authActionRateLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { password, nombre, apellido, fechaNacimiento } = req.body || {}
    const email = normalizeEmail(req.body?.email)

    if (!EMAIL_RE.test(email) || !password || password.length < 8 || !nombre?.trim() || !apellido?.trim()) {
      return res.status(400).json({ error: 'Revisa los datos del formulario: hay campos inválidos o incompletos.' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const code = generateCode()

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        verificationCode: code,
      },
    })

    // El código nunca se devuelve en la respuesta: se envía únicamente
    // por correo. Si el envío falla (proveedor caído, límite alcanzado,
    // etc.) la cuenta igual queda creada — el usuario puede reintentarlo
    // con "Reenviar código" — pero se lo indicamos al frontend con
    // emailSent: false para que pueda avisarle.
    let emailSent = true
    try {
      await sendVerificationEmail({ to: email, code })
    } catch (err) {
      emailSent = false
      console.error('No se pudo enviar el correo de verificación:', err.message)
    }

    res.status(201).json({ email, emailSent })
  }),
)

// POST /api/auth/resend-code
authRouter.post(
  '/resend-code',
  authActionRateLimiter,
  validate(emailOnlySchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'No encontramos una cuenta con este correo.' })
    if (user.verified) return res.status(400).json({ error: 'Esta cuenta ya está verificada.' })

    const code = generateCode()
    await prisma.user.update({ where: { id: user.id }, data: { verificationCode: code } })

    let emailSent = true
    try {
      await sendVerificationEmail({ to: email, code })
    } catch (err) {
      emailSent = false
      console.error('No se pudo reenviar el correo de verificación:', err.message)
    }

    res.json({ emailSent })
  }),
)

// POST /api/auth/verify
authRouter.post(
  '/verify',
  loginRateLimiter,
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const code = String(req.body?.code || '').trim()

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'No encontramos una cuenta con este correo.' })
    if (user.verified) return res.json({ ok: true })
    if (!code || user.verificationCode !== code) {
      return res.status(400).json({ error: 'El código ingresado no es válido.' })
    }

    await prisma.user.update({ where: { id: user.id }, data: { verified: true, verificationCode: null } })
    res.json({ ok: true })
  }),
)

// POST /api/auth/login
authRouter.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const { password } = req.body || {}

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' })

    const matches = await bcrypt.compare(password || '', user.passwordHash)
    if (!matches) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' })

    if (!user.verified) {
      return res.status(403).json({ error: 'Debes verificar tu correo antes de iniciar sesión.', needsVerification: true })
    }

    const token = signToken({ sub: user.id })
    res.json({ token, user: serializeUser(user) })
  }),
)

// GET /api/auth/me — usado al recargar la app para restaurar la sesión
// a partir del token guardado en el navegador.
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: serializeUser(req.user) })
  }),
)

// PATCH /api/auth/me — editar nombre/apellido/fecha de nacimiento desde
// "Mi cuenta". El correo NO se puede cambiar aquí a propósito: es el
// identificador de login y cambiarlo requeriría re-verificarlo, como al
// registrarse — se puede agregar más adelante si hace falta.
authRouter.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { nombre, apellido, fechaNacimiento } = req.body
    const data = {}
    if (nombre !== undefined) data.nombre = nombre
    if (apellido !== undefined) data.apellido = apellido
    if (fechaNacimiento !== undefined) data.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null

    const user = await prisma.user.update({ where: { id: req.user.id }, data })
    res.json({ user: serializeUser(user) })
  }),
)

// POST /api/auth/change-password — cambiar contraseña estando logueado
// (distinto del flujo de "olvidé mi contraseña", que no pide la actual).
authRouter.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash)
    if (!valid) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } })
    res.json({ ok: true })
  }),
)

// POST /api/auth/forgot-password
authRouter.post(
  '/forgot-password',
  authActionRateLimiter,
  validate(emailOnlySchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'No encontramos una cuenta con este correo.' })

    const code = generateCode()
    await prisma.user.update({ where: { id: user.id }, data: { resetCode: code } })

    let emailSent = true
    try {
      await sendPasswordResetEmail({ to: email, code })
    } catch (err) {
      emailSent = false
      console.error('No se pudo enviar el correo de restablecimiento de contraseña:', err.message)
    }

    res.json({ emailSent })
  }),
)

// POST /api/auth/reset-password
authRouter.post(
  '/reset-password',
  loginRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const code = String(req.body?.code || '').trim()
    const { newPassword } = req.body || {}

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'No encontramos una cuenta con este correo.' })
    if (!code || user.resetCode !== code) {
      return res.status(400).json({ error: 'El código ingresado no es válido.' })
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, resetCode: null } })
    res.json({ ok: true })
  }),
)

// -----------------------------------------------------------------------
// Login con Google (OAuth 2.0, flujo "Authorization Code").
//
// Flujo completo:
//   1. El botón "Continuar con Google" del frontend hace un GET normal
//      (navegación de navegador, no fetch) a /api/auth/google.
//   2. Esta ruta redirige a la pantalla de consentimiento de Google, con
//      un `state` firmado (JWT de corta duración) como mitigación CSRF.
//   3. Google redirige de vuelta a /api/auth/google/callback con `code`
//      y el mismo `state`.
//   4. El callback valida el `state`, intercambia el `code` por un perfil
//      de Google, busca/crea/vincula el usuario, y redirige al frontend
//      con un token de sesión de TecRuta (el mismo formato que devuelve
//      /api/auth/login) en la URL — el frontend lo recoge en
//      /auth/google/callback y completa el login igual que uno normal.
// -----------------------------------------------------------------------

const GOOGLE_STATE_PURPOSE = 'google-oauth-state'

function getFrontendUrl() {
  // Reutiliza CORS_ORIGIN: ya es, por definición, el origen del frontend
  // que esta API acepta — no hace falta una variable de entorno nueva.
  return (process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
}

// GET /api/auth/google
// Navegación de navegador (no fetch/XHR): el botón de la UI es un <a> o
// hace window.location.href = esta URL.
authRouter.get('/google', (req, res) => {
  try {
    const state = jwt.sign({ purpose: GOOGLE_STATE_PURPOSE }, process.env.JWT_SECRET, { expiresIn: '10m' })
    res.redirect(buildGoogleAuthUrl(state))
  } catch (err) {
    console.error('No se pudo iniciar el login con Google:', err.message)
    res.redirect(`${getFrontendUrl()}/iniciar-sesion?googleError=config`)
  }
})

// GET /api/auth/google/callback
authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const frontendUrl = getFrontendUrl()
    const { code, state, error } = req.query || {}

    if (error) {
      // El usuario canceló el consentimiento, o Google reportó un error.
      return res.redirect(`${frontendUrl}/iniciar-sesion?googleError=denied`)
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/iniciar-sesion?googleError=invalid`)
    }

    try {
      const statePayload = jwt.verify(state, process.env.JWT_SECRET)
      if (statePayload.purpose !== GOOGLE_STATE_PURPOSE) throw new Error('state inválido')
    } catch {
      return res.redirect(`${frontendUrl}/iniciar-sesion?googleError=state`)
    }

    let profile
    try {
      const accessToken = await exchangeCodeForAccessToken(code)
      profile = await fetchGoogleProfile(accessToken)
    } catch (err) {
      console.error('Falló el intercambio con Google:', err.message)
      return res.redirect(`${frontendUrl}/iniciar-sesion?googleError=exchange`)
    }

    if (!profile?.email) {
      return res.redirect(`${frontendUrl}/iniciar-sesion?googleError=no-email`)
    }

    const email = normalizeEmail(profile.email)

    // 1) ¿Ya existe una cuenta vinculada a este googleId? (login recurrente)
    let user = await prisma.user.findUnique({ where: { googleId: profile.sub } })

    // 2) Si no, ¿existe una cuenta con este correo creada por otra vía
    //    (registro tradicional, o un login de Google anterior con otro
    //    googleId)? Si existe, se vincula esta cuenta de Google a ella en
    //    vez de crear un usuario duplicado.
    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } })
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: profile.sub,
            // Si la cuenta existente aún no estaba verificada, el login
            // con Google confirma que el correo sí es del usuario.
            verified: true,
          },
        })
      }
    }

    // 3) Si tampoco existe por correo, se crea una cuenta nueva. La
    //    contraseña se genera aleatoria e inutilizable — este usuario
    //    inicia sesión con Google; si más adelante quiere una contraseña
    //    propia, puede definirla con el flujo existente de "olvidé mi
    //    contraseña" (POST /api/auth/forgot-password).
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex')
      const passwordHash = await bcrypt.hash(randomPassword, 10)
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          nombre: profile.given_name?.trim() || profile.name?.trim() || 'Cliente',
          apellido: profile.family_name?.trim() || '',
          googleId: profile.sub,
          verified: true,
        },
      })
    }

    const token = signToken({ sub: user.id })
    res.redirect(`${frontendUrl}/auth/google/callback?token=${encodeURIComponent(token)}`)
  }),
)