import React, { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Banknote, ChevronDown, ClipboardList, ExternalLink, Home, LayoutGrid, LogOut, Package, ShieldCheck, ShoppingBag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import { STORE_ORIGIN, staffHome } from '../../app/urls.js'
import { isPrimaryActive, panelRoleName, primaryNavigation } from '../../app/panelNavigation.js'
import './workspace.css'
const icons = { home: Home, sell: ShoppingBag, orders: ClipboardList, inventory: Package, cash: Banknote, more: LayoutGrid }
export default function WorkspaceShell({ children, beforeLeave }) {
  const { user, logout } = useAuth(), location = useLocation(), navigate = useNavigate(), account = useRef(null)
  useEffect(() => { if (account.current) account.current.open = false }, [location.pathname])
  const follow = (event, to) => { if (to !== location.pathname && beforeLeave && !beforeLeave(to)) event.preventDefault() }
  return <div className="workspace min-h-screen bg-paper text-ink dark:bg-night dark:text-paper">
    <a href="#contenido-panel" className="workspace-skip">Saltar al contenido</a>
    <header className="workspace-header">
      <div className="workspace-top">
        <Link to={staffHome(user.role)} onClick={e => follow(e, staffHome(user.role))} className="workspace-brand" aria-label="Panel TecRuta — inicio"><span className="workspace-mark">TR</span><span>TecRuta <small>Panel de trabajo</small></span></Link>
        <div className="workspace-account"><ThemeToggle /><details ref={account} onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus() } }}>
          <summary aria-label="Mi cuenta" className="workspace-account-trigger"><span className="workspace-avatar" aria-hidden="true">{user.nombre?.slice(0, 1)}</span><span className="hidden sm:block"><strong>{user.nombre}</strong><small>{panelRoleName[user.role]}</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="workspace-account-menu"><p>{user.nombre} {user.apellido}<small>{panelRoleName[user.role]}</small></p><Link to="/seguridad" onClick={e => follow(e, '/seguridad')}><ShieldCheck size={17} />Contraseña y seguridad</Link><a href={STORE_ORIGIN} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} />Ver tienda pública</a><button type="button" onClick={() => { if (!beforeLeave || beforeLeave('/iniciar-sesion')) { logout(); navigate('/iniciar-sesion', { replace: true }) } }}><LogOut size={17} />Cerrar sesión</button></div>
        </details></div>
      </div>
      <nav aria-label="Secciones del panel" className="workspace-navigation">{primaryNavigation(user.role).map(item => { const Icon = icons[item.icon], active = isPrimaryActive(item.to, location.pathname, user.role); return <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} onClick={e => follow(e, item.to)}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></Link> })}</nav>
    </header>
    <div className="workspace-content">{children}</div>
  </div>
}
