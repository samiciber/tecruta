import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, MailCheck } from 'lucide-react'
import AuthCard from '../components/auth/AuthCard.jsx'
import PasswordInput from '../components/auth/PasswordInput.jsx'
import FormBanner from '../components/auth/FormBanner.jsx'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const { requestPasswordReset, resetPassword } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()

  const [step, setStep] = useState('email') // 'email' | 'reset' | 'done'
  const [email, setEmail] = useState('')
  const [emailFailed, setEmailFailed] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleRequestCode = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!EMAIL_RE.test(email.trim())) {
      setFormError('Ingresa un correo válido.')
      return
    }
    setSubmitting(true)
    const result = await requestPasswordReset(email)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      toast?.showToast(result.error, 'error')
      return
    }
    setEmailFailed(result.emailSent === false)
    setStep('reset')
    if (result.emailSent === false) {
      toast?.showToast('No pudimos enviarte el correo. Intenta de nuevo en unos minutos.', 'error')
    } else {
      toast?.showToast('Enviamos un código para restablecer tu contraseña.', 'success')
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setFormError('')
    if (code.trim().length !== 6) {
      setFormError('Ingresa el código de 6 dígitos.')
      return
    }
    if (password.length < 8) {
      setFormError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    const result = await resetPassword(email, code, password)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      toast?.showToast(result.error, 'error')
      return
    }
    setStep('done')
    toast?.showToast('Tu contraseña se actualizó correctamente.', 'success')
  }

  if (step === 'done') {
    return (
      <AuthCard title="Contraseña actualizada" subtitle="Ya puedes iniciar sesión con tu nueva contraseña.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal-green/15 text-signal-green">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <button type="button" onClick={() => navigate('/iniciar-sesion')} className="btn-primary w-full">
            Iniciar sesión
          </button>
        </div>
      </AuthCard>
    )
  }

  if (step === 'reset') {
    return (
      <AuthCard
        title="Restablece tu contraseña"
        subtitle={
          <>
            Ingresa el código que enviamos a <span className="font-medium text-ink dark:text-paper">{email}</span> y tu nueva contraseña.
          </>
        }
        footer={
          <button type="button" onClick={() => setStep('email')} className="w-full text-center text-sm font-medium text-route hover:underline">
            Usar otro correo
          </button>
        }
      >
        {emailFailed && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-signal-red/30 bg-signal-red/10 px-3 py-2.5 text-sm text-signal-red">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>No pudimos enviarte el correo con el código. Vuelve a "Recupera tu contraseña" para reintentarlo.</span>
          </div>
        )}

        <form onSubmit={handleReset} noValidate className="flex flex-col gap-4">
          <FormBanner tone="error">{formError}</FormBanner>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Código de verificación</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="input-tr text-center text-lg font-semibold tracking-[0.3em]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Nueva contraseña</span>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Confirmar nueva contraseña</span>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Repite tu nueva contraseña"
            />
          </label>

          <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
            {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Restablecer contraseña'}
          </button>
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Recupera tu contraseña"
      subtitle="Ingresa tu correo y te enviaremos un código para restablecerla."
      footer={
        <p className="text-center text-sm text-ink-soft dark:text-paper/60">
          ¿La recordaste?{' '}
          <Link to="/iniciar-sesion" className="font-semibold text-route hover:underline">
            Inicia sesión
          </Link>
        </p>
      }
    >
      <form onSubmit={handleRequestCode} noValidate className="flex flex-col gap-4">
        <FormBanner tone="error">{formError}</FormBanner>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
            className="input-tr"
          />
        </label>

        <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Enviar código'}
        </button>
      </form>
    </AuthCard>
  )
}