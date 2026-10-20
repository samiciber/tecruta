import React, { useContext, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard.jsx'
import PasswordInput from '../components/auth/PasswordInput.jsx'
import FormBanner from '../components/auth/FormBanner.jsx'
import GoogleButton from '../components/auth/GoogleButton.jsx'
import { clearGoogleFlow } from '../services/googleFlow.js'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Mensajes legibles para cada valor de ?googleError= con el que el
// backend puede redirigir de vuelta aquí si algo falla en el flujo de
// Google (ver GET /api/auth/google/callback).
const GOOGLE_ERROR_MESSAGES = {
  denied: 'Cancelaste el inicio de sesión con Google.',
  invalid: 'No se pudo completar el inicio de sesión con Google. Inténtalo de nuevo.',
  state: 'La sesión de Google expiró o no es válida. Inténtalo de nuevo.',
  exchange: 'Hubo un problema al conectar con Google. Inténtalo de nuevo en unos segundos.',
  'no-email': 'Tu cuenta de Google no tiene un correo disponible para continuar.',
  config: 'El inicio de sesión con Google no está disponible en este momento.',
  linking: 'Verifica o recupera primero tu cuenta local antes de continuar con Google. Si ya vinculaste otra cuenta de Google, usa esa cuenta.',
  unavailable: 'No pudimos completar el acceso. Inténtalo nuevamente en unos minutos.',
}

export default function Login() {
  const { login } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const googleError = searchParams.get('googleError')
    if (!googleError) return
    clearGoogleFlow(window.sessionStorage)
    setFormError(GOOGLE_ERROR_MESSAGES[googleError] || 'No se pudo iniciar sesión con Google.')
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emailError = touched.email && !EMAIL_RE.test(form.email.trim()) ? 'Ingresa un correo válido.' : ''
  const passwordError = touched.password && !form.password ? 'Ingresa tu contraseña.' : ''

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
    if (formError) setFormError('')
  }
  const markTouched = (field) => () => setTouched((t) => ({ ...t, [field]: true }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    setFormError('')
    if (!EMAIL_RE.test(form.email.trim()) || !form.password) return

    setSubmitting(true)
    const result = await login(form)
    setSubmitting(false)

    if (!result.ok) {
      setFormError(result.error)
      toast?.showToast(result.error, 'error')
      if (result.needsVerification) {
        navigate(`/verificar-correo?email=${encodeURIComponent(form.email.trim())}`)
      }
      return
    }

    toast?.showToast('Sesión iniciada. ¡Bienvenido de vuelta!', 'success')
    navigate('/')
  }

  return (
    <AuthCard
      title="Inicia sesión"
      subtitle="Accede a tu cuenta para ver tus pedidos y agilizar tus compras."
      footer={
        <p className="text-center text-sm text-ink-soft dark:text-paper/60">
          ¿No tienes cuenta?{' '}
          <Link to="/crear-cuenta" className="font-semibold text-route hover:underline">
            Crea una gratis
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormBanner tone="error">{formError}</FormBanner>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Correo electrónico</span>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            onBlur={markTouched('email')}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
            className={`input-tr ${emailError ? 'border-signal-red focus:border-signal-red' : ''}`}
          />
          {emailError && <span className="text-xs text-signal-red">{emailError}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Contraseña</span>
          <PasswordInput
            value={form.password}
            onChange={set('password')}
            onBlur={markTouched('password')}
            autoComplete="current-password"
            error={!!passwordError}
          />
          {passwordError && <span className="text-xs text-signal-red">{passwordError}</span>}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-xs">La sesión se conserva en esta pestaña.</p>
          <Link to="/recuperar-contrasena" className="font-medium text-route hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Iniciar sesión'}
        </button>

        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-ink-soft/60 dark:text-paper/40">
          <span className="h-px flex-1 bg-paper-line dark:bg-night-line" />
          o
          <span className="h-px flex-1 bg-paper-line dark:bg-night-line" />
        </div>

        <GoogleButton remember={form.remember} />
      </form>
    </AuthCard>
  )
}