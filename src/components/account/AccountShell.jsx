import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ACCOUNT_LINKS } from '../layout/AccountMenu.jsx'
import { useAuth } from '../../hooks/useAuth.js'

// Estructura común de las páginas de cuenta: menú lateral + contenido.
// `requireLogin`: si no hay sesión, muestra una invitación a iniciarla.
export default function AccountShell({ title, description, requireLogin = false, children }) {
  const { isAuthenticated, authLoading } = useAuth()
  const blocked = requireLogin && !isAuthenticated && !authLoading

  return (
    <div className="container-tr grid gap-8 py-8 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Mi cuenta" className="hidden lg:block">
        <ul className="sticky top-40 space-y-1">
          {ACCOUNT_LINKS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink to={to} end className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-white/10 ${isActive ? 'bg-header/10 font-bold text-header dark:text-sky-300' : 'text-ink dark:text-paper'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-labelledby="account-title">
        <h1 id="account-title" className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft dark:text-paper/70">{description}</p>}
        <div className="mt-6">
          {authLoading ? (
            <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>
          ) : blocked ? (
            <div className="rounded-xl2 border border-dashed border-paper-line p-8 text-center dark:border-night-line">
              <p className="font-bold text-ink dark:text-paper">Inicia sesión para ver esta sección</p>
              <p className="mt-1 text-sm text-ink-soft dark:text-paper/70">Tu información está asociada a tu cuenta de TecRuta.</p>
              <div className="mt-4 flex justify-center gap-3">
                <Link to="/iniciar-sesion" className="btn-primary">Iniciar sesión</Link>
                <Link to="/crear-cuenta" className="btn-secondary">Crear cuenta</Link>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </section>
    </div>
  )
}