import React from 'react'
import { Link } from 'react-router-dom'
import { UserCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'

// Franja de la Home solo para visitantes sin sesión.
export default function GuestStrip() {
  const { isAuthenticated, authLoading } = useAuth()
  if (isAuthenticated || authLoading) return null
  return (
    <section aria-label="Beneficios de tener una cuenta" className="border-b border-paper-line bg-paper-surface dark:border-night-line dark:bg-night-surface">
      <div className="container-tr flex flex-col items-center gap-4 py-5 sm:flex-row sm:justify-between">
        <div className="flex items-start gap-3 text-center sm:text-left">
          <UserCircle className="mt-0.5 hidden h-7 w-7 shrink-0 text-ink-soft dark:text-paper/60 sm:block" aria-hidden="true" />
          <div>
            <p className="text-base font-medium text-ink dark:text-paper sm:text-lg">Inicia sesión para envío gratis*, recomendaciones, seguimiento fácil de pedidos y mucho más.</p>
            <p className="mt-1 text-xs text-ink-soft dark:text-paper/60">*Se aplican exclusiones. <Link to="/ayuda" className="text-header underline dark:text-sky-300">Más información.</Link></p>
          </div>
        </div>
        <Link to="/iniciar-sesion" className="shrink-0 rounded-md bg-header px-8 py-3 text-sm font-bold text-white hover:bg-header-band">Iniciar sesión</Link>
      </div>
    </section>
  )
}