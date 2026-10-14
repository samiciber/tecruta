// Login con Google (OAuth 2.0, flujo "Authorization Code") vía fetch
// nativo de Node, sin SDK adicional — mismo criterio que lib/mailer.js
// (Resend) y lib/cloudinary.js (Cloudinary): una integración pequeña no
// justifica una dependencia extra.
//
// Variables de entorno requeridas (ver server/.env.example):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_CALLBACK_URL

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

function getCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error(
      'Google OAuth no está configurado en el servidor: faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_CALLBACK_URL en server/.env.',
    )
  }
  return { clientId, clientSecret, callbackUrl }
}

// Construye la URL a la que se redirige al navegador para iniciar el
// consentimiento de Google. `state` es un token de un solo uso (ver
// GET /api/auth/google en auth.routes.js) que se verifica al volver en el
// callback, como mitigación de CSRF.
export function buildGoogleAuthUrl(state, codeChallenge) {
  const { clientId, callbackUrl } = getCredentials()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// Intercambia el `code` que Google manda al callback por un access_token
// utilizable para pedir el perfil del usuario.
export async function exchangeCodeForAccessToken(code, codeVerifier) {
  const { clientId, clientSecret, callbackUrl } = getCredentials()

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      code_verifier: codeVerifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Google respondió ${response.status} al intercambiar el código.`)
  }

  const data = await response.json()
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('Google no devolvió un acceso válido.')
  return data.access_token
}

// Con el access_token, pide el perfil básico del usuario (correo, nombre,
// si el correo está verificado, id estable de la cuenta de Google).
export async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Google respondió ${response.status} al pedir el perfil.`)
  }

  // Shape relevante: { sub, email, email_verified, given_name, family_name, name, picture }
  return response.json()
}