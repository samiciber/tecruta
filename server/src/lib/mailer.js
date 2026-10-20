// Envío de correos transaccionales vía Resend (https://resend.com).
// Se usa fetch nativo de Node en vez del SDK oficial para no añadir una
// dependencia extra solo para dos llamadas HTTP.

const RESEND_API_URL = 'https://api.resend.com/emails'

function getFrom() {
  return process.env.EMAIL_FROM || 'TecRuta <no-reply@tecruta.com>'
}

async function sendEmail({ to, subject, html, idempotencyKey }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurado en server/.env — no se puede enviar correo.')
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: getFrom(), to, subject, html }),
  })

  if (!response.ok) {
    throw new Error(`El proveedor de correo respondió ${response.status}.`)
  }

  return response.json()
}

function codeEmailHtml({ heading, intro, code }) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <h1 style="font-size: 20px; margin: 0 0 8px;">${heading}</h1>
      <p style="font-size: 14px; color: #555; line-height: 1.5; margin: 0 0 24px;">${intro}</p>
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 12px 28px; background: #f4f4f4; border-radius: 8px;">
          ${code}
        </span>
      </div>
      <p style="font-size: 12px; color: #999; line-height: 1.5; margin: 0;">
        Si no solicitaste este código, puedes ignorar este correo con confianza — tu cuenta sigue segura.
      </p>
      <p style="font-size: 12px; color: #999; margin: 24px 0 0;">— El equipo de TecRuta</p>
    </div>
  `
}

export async function sendVerificationEmail({ to, code }) {
  return sendEmail({
    to,
    subject: 'Verifica tu correo — TecRuta',
    html: codeEmailHtml({
      heading: 'Confirma tu cuenta',
      intro: 'Usa este código de 6 dígitos para verificar tu correo y activar tu cuenta en TecRuta. Caduca en 15 minutos.',
      code,
    }),
  })
}

export async function sendPasswordResetEmail({ to, code }) {
  return sendEmail({
    to,
    subject: 'Restablece tu contraseña — TecRuta',
    html: codeEmailHtml({
      heading: 'Restablece tu contraseña',
      intro: 'Usa este código de 6 dígitos para crear una nueva contraseña en TecRuta. Caduca en 15 minutos.',
      code,
    }),
  })
}

export async function sendStaffActivationEmail({ to, code, activationUrl }) {
  return sendEmail({ to, subject: 'Activa tu acceso al Panel TecRuta', html: codeEmailHtml({
    heading: 'Tu cuenta de trabajo en TecRuta',
    intro: `Un administrador autorizó tu cuenta. Entra a <a href="${activationUrl}">Panel TecRuta · Activar cuenta</a>, solicita un código nuevo si este vence y establece tu propia contraseña. Código válido durante 15 minutos.`,
    code,
  }) })
}

export async function sendReviewInvitation({ to, productUrl, idempotencyKey }) {
  // productUrl is constructed from a configured HTTPS origin and encoded slug.
  const safeUrl = productUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  return sendEmail({ to, idempotencyKey, subject: '¿Cómo fue tu compra en TecRuta?',
    html: `<p>Tu pedido fue entregado. Puedes compartir tu experiencia del producto desde tu cuenta.</p><p><a href="${safeUrl}">Escribir una reseña</a></p>` })
}
