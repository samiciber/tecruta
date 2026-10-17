import React, { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CircleHelp, CreditCard, Heart, LogOut, Receipt, Settings, ShieldCheck, ShoppingBag, Sparkles, Truck, User, UserCircle, Wallet,
} from 'lucide-react'
import FloatingPanel from './header/FloatingPanel.jsx'
import { PANEL_ORIGIN } from '../../app/urls.js'
import { useAuth } from '../../hooks/useAuth.js'

export const ACCOUNT_LINKS = [
  { to: '/mi-cuenta', label: 'Cuenta', Icon: UserCircle },
  { to: '/mis-pedidos', label: 'Compras', Icon: Receipt },
  { to: '/pagos', label: 'Pagos', Icon: CreditCard },
  { to: '/mi-tarjeta', label: 'Mi tarjeta de crédito', Icon: Wallet },
  { to: '/planes', label: 'Planes y suscripciones', Icon: ShieldCheck },
  { to: '/elementos-guardados', label: 'Elementos guardados', Icon: Heart },
  { to: '/mi-cuenta#configuracion', label: 'Configuración de la cuenta', Icon: Settings },
  { to: '/ayuda', label: 'Apoyo', Icon: CircleHelp },
]

const BENEFITS = [
  { Icon: Truck, label: 'Envío gratuito' },
  { Icon: CreditCard, label: 'Pago conveniente' },
  { Icon: ShoppingBag, label: 'Seguimiento fácil de pedidos' },
  { Icon: Sparkles, label: 'Compras personalizadas' },
]

export function AccountBlockLabel({ user, isAuthenticated }) {
  return (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white">
        <User className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="flex flex-col text-[15px] leading-tight">
        <span className="font-normal">Cuenta</span>
        <span className="max-w-[9rem] truncate font-semibold">{isAuthenticated ? user.nombre || 'Mi cuenta' : 'Iniciar sesión'}</span>
      </span>
    </>
  )
}

export function AccountPanelBody({ onNavigate }) {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="px-5 pb-5">
      {isAuthenticated ? (
        <div className="mb-3 flex items-center gap-3">
          <UserCircle className="h-8 w-8 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-bold">Hola, {user.nombre} {user.apellido}</p>
            <p className="truncate text-xs text-ink-soft dark:text-paper/60">{user.email}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-start gap-2">
            <UserCircle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            <p className="text-[17px] font-bold leading-snug">Consigue más con una cuenta de TecRuta</p>
          </div>
          <ul className="mb-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            {BENEFITS.map(({ Icon, label }) => (
              <li key={label} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft dark:text-paper/60" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/iniciar-sesion" onClick={onNavigate} className="rounded-md bg-header py-2.5 text-center text-sm font-bold text-white hover:bg-header-band">Iniciar sesión</Link>
            <Link to="/crear-cuenta" onClick={onNavigate} className="rounded-md border border-header py-2.5 text-center text-sm font-bold text-header hover:bg-header/5 dark:border-sky-300 dark:text-sky-300">Crear cuenta</Link>
          </div>
          <p className="mt-2 text-xs text-ink-soft dark:text-paper/60">
            *Se aplican exclusiones. <Link to="/ayuda" onClick={onNavigate} className="font-medium text-header underline dark:text-sky-300">Más información.</Link>
          </p>
        </>
      )}
      <div className="my-4 h-px bg-gray-200 dark:bg-night-line" />
      <ul aria-label="Mi cuenta">
        {ACCOUNT_LINKS.map(({ to, label, Icon }) => (
          <li key={to}>
            <Link to={to} onClick={onNavigate} className="flex items-center gap-4 rounded-md px-2 py-3 text-[15px] hover:bg-gray-100 dark:hover:bg-white/10">
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
        {isAuthenticated && ['ADMIN', 'WAREHOUSE', 'CASHIER'].includes(user.role) && (
          <li>
            <a href={PANEL_ORIGIN} onClick={onNavigate} className="flex items-center gap-4 rounded-md px-2 py-3 text-[15px] font-medium text-header hover:bg-gray-100 dark:text-sky-300 dark:hover:bg-white/10">
              <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
              Panel TecRuta
            </a>
          </li>
        )}
        {isAuthenticated && ['ADMIN', 'CASHIER'].includes(user.role) && <li><a href={PANEL_ORIGIN + '/pos'} onClick={onNavigate} className="flex items-center gap-4 rounded-md px-2 py-3 font-semibold text-route">Punto de venta</a></li>}
        {isAuthenticated && (
          <li>
            <button
              type="button"
              onClick={() => { logout(); onNavigate?.(); navigate('/') }}
              className="flex w-full items-center gap-4 rounded-md px-2 py-3 text-left text-[15px] font-medium text-signal-red hover:bg-signal-red/10"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              Cerrar sesión
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}

// Bloque "Cuenta" del header de escritorio + popover (con y sin sesión).
export default function AccountMenu({ open, onToggle, onClose }) {
  const { user, isAuthenticated } = useAuth()
  const ref = useRef(null)
  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="panel-account"
        onClick={onToggle}
        className="flex items-center gap-2 rounded px-2 py-1 text-left text-white hover:bg-white/10"
      >
        <AccountBlockLabel user={user} isAuthenticated={isAuthenticated} />
      </button>
      {open && (
        <FloatingPanel id="panel-account" title="Cuenta" width="w-[24rem]" align="right" arrow hideTitle triggerRef={ref} onClose={onClose}>
          <AccountPanelBody onNavigate={onClose} />
        </FloatingPanel>
      )}
    </div>
  )
}
