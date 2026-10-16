import React from 'react'
import { Link } from 'react-router-dom'
import { UserCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'

// Invitación de acceso para visitantes; no anuncia condiciones comerciales.
export default function GuestStrip({ message = 'Accede a tu cuenta para consultar y gestionar tus pedidos.', buttonLabel = 'Acceder a mi cuenta', href = '/iniciar-sesion' }) {
  const { isAuthenticated, authLoading } = useAuth()
  if (isAuthenticated || authLoading) return null
  return (
    <section aria-label="Acceso a tu cuenta" className="border-b border-paper-line bg-paper-surface dark:border-night-line dark:bg-night-surface">
      <div className="container-tr flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between sm:gap-4 sm:py-5">
        <div className="flex items-start gap-3 text-center sm:text-left">
          <UserCircle className="mt-0.5 hidden h-7 w-7 shrink-0 text-ink-soft dark:text-paper/60 sm:block" aria-hidden="true" />
          <div>
            <p className="text-base font-medium text-ink dark:text-paper sm:text-lg">{message}</p>
          </div>
        </div>
        <Link to={href} className="shrink-0 rounded-md bg-header px-8 py-3 text-sm font-bold text-white hover:bg-header-band">{buttonLabel}</Link>
      </div>
    </section>
  )
}
