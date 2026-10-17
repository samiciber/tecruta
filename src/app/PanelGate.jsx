import React from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import SessionUnavailable from '../components/auth/SessionUnavailable.jsx'
import { STAFF_ROLES } from './urls.js'

export default function PanelGate({ children }) {
  const { user, authLoading, authError, retrySession, logout } = useAuth()
  const location = useLocation()
  if (authError) return <SessionUnavailable onRetry={retrySession} />
  if (authLoading) return <p role="status" className="p-10">Comprobando sesión…</p>
  if (!user) return <Navigate to={`/iniciar-sesion?volver=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />
  if (!STAFF_ROLES.includes(user.role)) return <div className="mx-auto max-w-lg p-10"><h1 className="text-2xl font-bold">Acceso denegado</h1><p className="my-4">Tu cuenta no tiene acceso al Panel TecRuta. Contacta al administrador.</p><Link className="btn-primary" to="/iniciar-sesion" onClick={logout}>Usar otra cuenta</Link></div>
  return children
}
