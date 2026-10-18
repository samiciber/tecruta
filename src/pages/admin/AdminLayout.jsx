import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { staffHome } from '../../app/urls.js'
import WorkspaceShell from '../../components/admin/WorkspaceShell.jsx'

export default function AdminLayout() {
  const { user } = useAuth(), location = useLocation()
  if (user && user.role !== 'ADMIN' && location.pathname !== '/inventario') return <Navigate to={staffHome(user.role)} replace />
  return <WorkspaceShell><main id="contenido-panel" className="min-w-0"><Outlet /></main></WorkspaceShell>
}
