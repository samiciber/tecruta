import React, { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import AuthCard from '../../components/auth/AuthCard.jsx'
import PasswordInput from '../../components/auth/PasswordInput.jsx'
import SessionUnavailable from '../../components/auth/SessionUnavailable.jsx'
import { safePanelReturn, staffHome, STAFF_ROLES, STORE_ORIGIN } from '../../app/urls.js'

export default function PanelLogin() {
  const auth = useAuth(), [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  if (auth.authError) return <SessionUnavailable onRetry={auth.retrySession} />
  if (auth.authLoading) return <p role="status" className="p-10">Comprobando sesión…</p>
  if (auth.user && STAFF_ROLES.includes(auth.user.role)) return <Navigate to={safePanelReturn(params.get('volver'), staffHome(auth.user.role))} replace />
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const result = await auth.login({ ...form, panel: true })
    if (!result.ok) setError(result.error)
    setBusy(false)
  }
  return <AuthCard title="Panel TecRuta" subtitle="Acceso del personal autorizado. Usa tu cuenta individual." footer={<a href={STORE_ORIGIN} className="text-sm text-route hover:underline">Ir a la tienda pública ↗</a>}>
    {auth.user ? <div><p role="alert" className="mb-4 text-sm">Acceso denegado. Tu cuenta no tiene permisos para este panel.</p><button className="btn-primary" onClick={auth.logout}>Usar otra cuenta</button></div> : <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="text-sm text-signal-red">{error}</p>}
      <label className="block text-sm">Correo electrónico<input required type="email" autoComplete="username" className="input-tr mt-1 w-full" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="block text-sm">Contraseña<PasswordInput autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.remember} onChange={e => setForm({ ...form, remember: e.target.checked })} />Recordar sesión en este equipo</label>
      <button disabled={busy} className="btn-primary w-full">{busy ? 'Ingresando…' : 'Ingresar al panel'}</button>
      <Link className="block text-sm text-route hover:underline" to="/recuperar-contrasena">Activar cuenta o recuperar contraseña</Link>
    </form>}
  </AuthCard>
}
