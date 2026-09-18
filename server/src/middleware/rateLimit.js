import rateLimit from 'express-rate-limit'

// Limita los intentos de login: hasta 8 por IP cada 15 minutos. Los
// intentos EXITOSOS no cuentan para el límite (skipSuccessfulRequests),
// así que un cliente que ya inició sesión varias veces seguidas sin
// problema nunca se ve afectado — esto es específicamente para frenar
// intentos de adivinar una contraseña.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos antes de volver a intentarlo.' },
})

// Limita registro, reenvío de código de verificación y solicitud de
// restablecimiento de contraseña: más generoso que el de login (no son
// intentos de "adivinar" nada), pero evita que alguien spamee de correos
// a una casilla ajena o cree cuentas en masa.
export const authActionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde este dispositivo. Espera unos minutos antes de volver a intentarlo.' },
})
