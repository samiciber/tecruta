import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard.jsx'
import PasswordInput from '../components/auth/PasswordInput.jsx'
import FormBanner from '../components/auth/FormBanner.jsx'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { login } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
          <label className="flex items-center gap-2 text-ink-soft dark:text-paper/60">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={set('remember')}
              className="h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line dark:bg-night-surface"
            />
            Recordar sesión
          </label>
          <Link to="/recuperar-contrasena" className="font-medium text-route hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Iniciar sesión'}
        </button>
      </form>
    </AuthCard>
  )
}