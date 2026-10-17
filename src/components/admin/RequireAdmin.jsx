import React from 'react'
import { Navigate } from 'react-router-dom'
import SessionUnavailable from '../auth/SessionUnavailable.jsx'
import { useAuth } from '../../hooks/useAuth.js'

export default function RequireAdmin({ children }) {
  const { user, authLoading, authError, retrySession } = useAuth()

  if (authError) return <SessionUnavailable onRetry={retrySession} />

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-route border-t-transparent" />
      </div>
    )
  }

  if (!user || !['ADMIN', 'WAREHOUSE', 'CASHIER'].includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}