import React, { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserCircle } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import SessionUnavailable from '../components/auth/SessionUnavailable.jsx'
import { ToastContext } from '../components/ui/ToastProvider.jsx'

function ProfileForm() {
  const { user, updateProfile } = useAuth()
  const toast = useContext(ToastContext)
  const [nombre, setNombre] = useState(user?.nombre || '')
  const [apellido, setApellido] = useState(user?.apellido || '')
  const [fechaNacimiento, setFechaNacimiento] = useState(user?.fechaNacimiento ? user.fechaNacimiento.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await updateProfile({ nombre, apellido, fechaNacimiento: fechaNacimiento || null })
    setSaving(false)
    if (result.ok) {
      toast?.showToast('Datos actualizados', 'success')
    } else {
      toast?.showToast(result.error, 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl2 border border-paper-line p-5 dark:border-night-line">
      <h2 className="font-display text-lg font-semibold text-ink dark:text-paper">Mis datos</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Correo</span>
        <input type="email" value={user?.email || ''} disabled className="input-tr opacity-60" />
        <span className="text-xs text-ink-soft/70 dark:text-paper/40">El correo no se puede cambiar aquí.</span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Nombre</span>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-tr" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Apellido</span>
          <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} className="input-tr" required />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Fecha de nacimiento (opcional)</span>
        <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="input-tr" />
      </label>

      <button type="submit" disabled={saving} className="btn-primary self-start">
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function PasswordForm() {
  const { changePassword } = useAuth()
  const toast = useContext(ToastContext)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setSaving(true)
    const result = await changePassword({ currentPassword, newPassword })
    setSaving(false)

    if (result.ok) {
      toast?.showToast('Contraseña actualizada. Inicia sesión nuevamente.', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl2 border border-paper-line p-5 dark:border-night-line">
      <h2 className="font-display text-lg font-semibold text-ink dark:text-paper">Cambiar contraseña</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Contraseña actual</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input-tr"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Nueva contraseña</span>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-tr" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Confirmar nueva contraseña</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-tr"
          required
        />
      </label>

      {error && <p className="text-sm text-signal-red">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary self-start">
        {saving ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}

function SessionsPanel() {
  const { logoutAll } = useAuth()
  const toast = useContext(ToastContext)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function closeAll() {
    if (busy) return
    setBusy(true); setError('')
    const result = await logoutAll()
    setBusy(false)
    if (result.ok) toast?.showToast('Se cerraron todas las sesiones. Inicia sesión nuevamente.', 'success')
    else setError(result.error)
  }
  return <section className="flex flex-col gap-3 rounded-xl2 border border-paper-line p-5 dark:border-night-line">
    <h2 className="font-display text-lg font-semibold text-ink dark:text-paper">Sesiones</h2>
    <p className="text-sm text-ink-soft dark:text-paper/60">Cierra el acceso de tu cuenta en todos los dispositivos, incluida esta pestaña.</p>
    {error && <p role="alert" className="text-sm text-ink dark:text-paper">{error}</p>}
    <button type="button" onClick={closeAll} disabled={busy} className="btn-primary self-start">{busy ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones'}</button>
  </section>
}

export default function Account() {
  const { isAuthenticated, authError, retrySession, authLoading } = useAuth()

  if (authError) return <SessionUnavailable onRetry={retrySession} />
  if (authLoading) return <div role="status" className="container-tr py-16 text-ink dark:text-paper">Comprobando sesión…</div>

  if (!isAuthenticated) {
    return (
      <div className="container-tr py-16">
        <EmptyState
          icon={UserCircle}
          title="Inicia sesión para ver tu cuenta"
          description="Esta sección está disponible solo para cuentas registradas."
          action={
            <Link to="/iniciar-sesion" className="btn-primary mt-2">
              Iniciar sesión
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-tr max-w-2xl py-10">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Mi cuenta</h1>
      <div className="flex flex-col gap-6">
        <ProfileForm />
        <PasswordForm />
        <SessionsPanel />
      </div>
    </div>
  )
}
