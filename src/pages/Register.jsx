import React, { useContext, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard.jsx'
import PasswordInput from '../components/auth/PasswordInput.jsx'
import FormBanner from '../components/auth/FormBanner.jsx'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i)

export default function Register() {
  const { register } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    apellido: '',
    dia: '',
    mes: '',
    anio: '',
  })
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (formError) setFormError('')
  }
  const markTouched = (field) => () => setTouched((t) => ({ ...t, [field]: true }))
  const markAllTouched = () =>
    setTouched({ email: true, password: true, confirmPassword: true, nombre: true, apellido: true, fecha: true })

  const errors = useMemo(() => {
    const e = {}
    if (touched.email && !EMAIL_RE.test(form.email.trim())) e.email = 'Ingresa un correo válido.'
    if (touched.password && form.password.length < 8) e.password = 'Usa al menos 8 caracteres.'
    if (touched.confirmPassword && form.confirmPassword !== form.password) e.confirmPassword = 'Las contraseñas no coinciden.'
    if (touched.nombre && !form.nombre.trim()) e.nombre = 'Ingresa tu nombre.'
    if (touched.apellido && !form.apellido.trim()) e.apellido = 'Ingresa tu apellido.'
    if (touched.fecha && (!form.dia || !form.mes || !form.anio)) e.fecha = 'Completa tu fecha de nacimiento.'
    return e
  }, [form, touched])

  const isValid =
    EMAIL_RE.test(form.email.trim()) &&
    form.password.length >= 8 &&
    form.confirmPassword === form.password &&
    form.nombre.trim() &&
    form.apellido.trim() &&
    form.dia &&
    form.mes &&
    form.anio

  const handleSubmit = async (e) => {
    e.preventDefault()
    markAllTouched()
    setFormError('')
    if (!isValid) return

    setSubmitting(true)
    const fechaNacimiento = `${form.anio}-${String(Number(form.mes) + 1).padStart(2, '0')}-${String(form.dia).padStart(2, '0')}`
    const result = await register({
      email: form.email,
      password: form.password,
      nombre: form.nombre,
      apellido: form.apellido,
      fechaNacimiento,
    })
    setSubmitting(false)

    if (!result.ok) {
      setFormError(result.error)
      toast?.showToast(result.error, 'error')
      return
    }

    if (result.emailSent) {
      toast?.showToast('Cuenta creada. Verifica tu correo para continuar.', 'success')
    } else {
      toast?.showToast('Cuenta creada, pero no pudimos enviarte el correo. Usa "Reenviar código" en la siguiente pantalla.', 'error')
    }
    navigate(`/verificar-correo?email=${encodeURIComponent(result.email)}`, {
      state: { emailSent: result.emailSent },
    })
  }

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Regístrate para agilizar tus próximas compras en TecRuta."
      footer={
        <p className="text-center text-sm text-ink-soft dark:text-paper/60">
          ¿Ya tienes cuenta?{' '}
          <Link to="/iniciar-sesion" className="font-semibold text-route hover:underline">
            Inicia sesión
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
            className={`input-tr ${errors.email ? 'border-signal-red focus:border-signal-red' : ''}`}
          />
          {errors.email && <span className="text-xs text-signal-red">{errors.email}</span>}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Contraseña</span>
            <PasswordInput
              value={form.password}
              onChange={set('password')}
              onBlur={markTouched('password')}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              error={!!errors.password}
            />
            {errors.password && <span className="text-xs text-signal-red">{errors.password}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Confirmar contraseña</span>
            <PasswordInput
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              onBlur={markTouched('confirmPassword')}
              autoComplete="new-password"
              placeholder="Repite tu contraseña"
              error={!!errors.confirmPassword}
            />
            {errors.confirmPassword && <span className="text-xs text-signal-red">{errors.confirmPassword}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Nombre</span>
            <input
              type="text"
              value={form.nombre}
              onChange={set('nombre')}
              onBlur={markTouched('nombre')}
              placeholder="Tu nombre"
              autoComplete="given-name"
              className={`input-tr ${errors.nombre ? 'border-signal-red focus:border-signal-red' : ''}`}
            />
            {errors.nombre && <span className="text-xs text-signal-red">{errors.nombre}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Apellido</span>
            <input
              type="text"
              value={form.apellido}
              onChange={set('apellido')}
              onBlur={markTouched('apellido')}
              placeholder="Tu apellido"
              autoComplete="family-name"
              className={`input-tr ${errors.apellido ? 'border-signal-red focus:border-signal-red' : ''}`}
            />
            {errors.apellido && <span className="text-xs text-signal-red">{errors.apellido}</span>}
          </label>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Fecha de nacimiento</span>
          <div className="grid grid-cols-3 gap-3">
            <select
              value={form.dia}
              onChange={set('dia')}
              onBlur={markTouched('fecha')}
              className={`input-tr ${errors.fecha ? 'border-signal-red focus:border-signal-red' : ''}`}
              aria-label="Día"
            >
              <option value="">Día</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={form.mes}
              onChange={set('mes')}
              onBlur={markTouched('fecha')}
              className={`input-tr ${errors.fecha ? 'border-signal-red focus:border-signal-red' : ''}`}
              aria-label="Mes"
            >
              <option value="">Mes</option>
              {MESES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={form.anio}
              onChange={set('anio')}
              onBlur={markTouched('fecha')}
              className={`input-tr ${errors.fecha ? 'border-signal-red focus:border-signal-red' : ''}`}
              aria-label="Año"
            >
              <option value="">Año</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {errors.fecha && <span className="text-xs text-signal-red">{errors.fecha}</span>}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Crear cuenta'}
        </button>

        <p className="text-center text-xs text-ink-soft/70 dark:text-paper/40">
          Al crear una cuenta aceptas nuestros{' '}
          <Link to="/legal/terminos" className="underline hover:text-route">
            Términos
          </Link>{' '}
          y{' '}
          <Link to="/legal/privacidad" className="underline hover:text-route">
            Política de privacidad
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  )
}