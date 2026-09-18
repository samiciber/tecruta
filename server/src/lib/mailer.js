// Envío de correos transaccionales vía Resend (https://resend.com).
// Se usa fetch nativo de Node en vez del SDK oficial para no añadir una
// dependencia extra solo para dos llamadas HTTP.

const RESEND_API_URL = 'https://api.resend.com/emails'

function getFrom() {
  return process.env.EMAIL_FROM || 'TecRuta <no-reply@tecruta.com>'
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurado en server/.env — no se puede enviar correo.')
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: getFrom(), to, subject, html }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend respondió con estado ${response.status}: ${detail}`)
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
      intro: 'Usa este código de 6 dígitos para verificar tu correo y activar tu cuenta en TecRuta.',
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
      intro: 'Usa este código de 6 dígitos para crear una nueva contraseña en TecRuta.',
      code,
    }),
  })
}
