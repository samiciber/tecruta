import React, { useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import AuthCard from '../components/auth/AuthCard.jsx'
import FormBanner from '../components/auth/FormBanner.jsx'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

const RESEND_COOLDOWN = 60

export default function VerifyEmail() {
  const { verifyEmail, resendCode } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()
  const location = useLocation()

  const params = new URLSearchParams(location.search)
  const email = params.get('email') || ''

  const [requestMessage, setRequestMessage] = useState(location.state?.message || '')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verified, setVerified] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  if (!email) {
    return (
      <AuthCard title="Falta el correo" subtitle="No encontramos el correo a verificar.">
        <Link to="/crear-cuenta" className="btn-primary w-full">
          Volver a crear cuenta
        </Link>
      </AuthCard>
    )
  }

  const code = digits.join('')

  const handleDigitChange = (index) => (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (formError) setFormError('')
    if (value && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    setDigits(Array.from({ length: 6 }, (_, i) => pasted[i] || ''))
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (code.length !== 6) {
      setFormError('Ingresa el código de 6 dígitos.')
      return
    }
    setSubmitting(true)
    const result = await verifyEmail(email, code)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      toast?.showToast(result.error, 'error')
      return
    }
    setVerified(true)
    toast?.showToast('¡Correo verificado! Tu cuenta ya está lista.', 'success')
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    const result = await resendCode(email)
    if (!result.ok) {
      toast?.showToast(result.error, 'error')
      return
    }
    setRequestMessage(result.message || 'Si corresponde, recibirás instrucciones por correo.')
    setCooldown(RESEND_COOLDOWN)
    toast?.showToast(result.message || 'Si corresponde, recibirás instrucciones por correo.', 'success')
  }

  if (verified) {
    return (
      <AuthCard title="Cuenta creada" subtitle="Tu cuenta quedó verificada correctamente.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal-green/15 text-signal-green">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="text-sm text-ink-soft dark:text-paper/60">
            Ya puedes iniciar sesión con <span className="font-medium text-ink dark:text-paper">{email}</span>.
          </p>
          <Link to="/iniciar-sesion" className="btn-primary w-full">
            Iniciar sesión
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Verifica tu correo"
      subtitle={
        <>
          Ingresa el código de 6 dígitos que recibas en{' '}
          <span className="font-medium text-ink dark:text-paper">{email}</span>.
        </>
      }
      footer={
        <p className="text-center text-sm text-ink-soft dark:text-paper/60">
          ¿Correo equivocado?{' '}
          <Link to="/crear-cuenta" className="font-semibold text-route hover:underline">
            Vuelve a crear tu cuenta
          </Link>
        </p>
      }
    >
      {requestMessage && <p role="status" className="mb-4 text-sm text-ink dark:text-paper">{requestMessage}</p>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormBanner tone="error">{formError}</FormBanner>

        <div className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={handleDigitChange(i)}
              onKeyDown={handleKeyDown(i)}
              aria-label={`Dígito ${i + 1} del código`}
              className="input-tr h-14 min-w-0 w-full px-1 text-center text-xl font-semibold tracking-widest"
            />
          ))}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Verificar cuenta'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="text-center text-sm font-medium text-route hover:underline disabled:cursor-not-allowed disabled:text-ink-soft/50 disabled:no-underline dark:disabled:text-paper/40"
        >
          {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
        </button>
        <p className="text-center text-xs text-ink-soft dark:text-paper/60">El código vence en 15 minutos. Si ya verificaste tu cuenta, <Link to="/iniciar-sesion" className="text-route hover:underline">inicia sesión</Link>.</p>
      </form>
    </AuthCard>
  )
}