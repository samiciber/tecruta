import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, LogOut, Package, MapPin, UserCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'

export default function AccountMenu() {
  const { user, isAuthenticated, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!isAuthenticated) {
    return (
      <Link
        to="/iniciar-sesion"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-paper-line text-ink-soft transition-colors hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper"
        aria-label="Iniciar sesión"
      >
        <User className="h-[18px] w-[18px]" />
      </Link>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-route/40 bg-route-soft text-route transition-colors hover:border-route dark:bg-route-softDark"
        aria-label="Cuenta"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{user.nombre?.[0]?.toUpperCase() || 'U'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-xl2 border border-paper-line bg-paper-surface p-2 shadow-card dark:border-night-line dark:bg-night-surface dark:shadow-card-dark">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink dark:text-paper">
              {user.nombre} {user.apellido}
            </p>
            <p className="truncate text-xs text-ink-soft dark:text-paper/50">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-paper-line dark:bg-night-line" />
          <Link
            to="/mi-cuenta"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 dark:text-paper dark:hover:bg-paper/10"
          >
            <UserCircle className="h-4 w-4" />
            Mi cuenta
          </Link>
          <Link
            to="/mis-pedidos"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 dark:text-paper dark:hover:bg-paper/10"
          >
            <Package className="h-4 w-4" />
            Mis pedidos
          </Link>
          <Link
            to="/mis-direcciones"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 dark:text-paper dark:hover:bg-paper/10"
          >
            <MapPin className="h-4 w-4" />
            Mis direcciones
          </Link>
          {user.role === 'ADMIN' && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-route transition-colors hover:bg-route-soft dark:hover:bg-route-softDark"
            >
              <ShieldCheck className="h-4 w-4" />
              Panel de administración
            </Link>
          )}
          <div className="my-1 h-px bg-paper-line dark:bg-night-line" />
          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-signal-red transition-colors hover:bg-signal-red/10"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}