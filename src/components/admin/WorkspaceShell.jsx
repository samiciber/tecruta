import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Banknote, ChevronDown, ClipboardList, ExternalLink, Home, LayoutGrid, LogOut, Package, ShieldCheck, ShoppingBag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import { STORE_ORIGIN, staffHome } from '../../app/urls.js'
import { isPrimaryActive, panelRoleName, primaryNavigation } from '../../app/panelNavigation.js'
import WorkspaceMore from './WorkspaceMore.jsx'
import { useWorkspacePreference } from '../../hooks/useWorkspaceMemory.js'
import './workspace.css'
const icons = { home: Home, sell: ShoppingBag, orders: ClipboardList, inventory: Package, cash: Banknote, more: LayoutGrid }
export default function WorkspaceShell({ children, beforeLeave }) {
  const { user, logout } = useAuth(), location = useLocation(), navigate = useNavigate(), account = useRef(null)
  const moreTrigger = useRef(null), [moreOpen, setMoreOpen] = useState(false)
  const [morePinned, setMorePinned] = useWorkspacePreference('more-pinned', false)
  const [moreQuery, setMoreQuery] = useWorkspacePreference('more-search', '')
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1280px)').matches)
  useEffect(() => { const media = window.matchMedia('(min-width: 1280px)'); const update = () => { setDesktop(media.matches); setMoreOpen(false) }; media.addEventListener('change', update); return () => media.removeEventListener('change', update) }, [])
  useLayoutEffect(() => { setMoreOpen(false) }, [location.pathname, location.search])
  const docked = user.role === 'ADMIN' && desktop && morePinned
  const closeMore = (restoreFocus = true) => { setMoreOpen(false); if (docked) setMorePinned(false); if (restoreFocus) requestAnimationFrame(() => moreTrigger.current?.focus()) }
  useEffect(() => { if (account.current) account.current.open = false }, [location.pathname])
  const follow = (event, to) => { if (to !== location.pathname && beforeLeave && !beforeLeave(to)) event.preventDefault() }
  const showBack = user.role === 'ADMIN' && location.pathname !== '/mas' && isPrimaryActive('/mas', location.pathname, user.role)
  const previousQuery = new URLSearchParams(typeof location.state?.moreSearch === 'string' ? location.state.moreSearch : '').get('buscar')
  const backTo = previousQuery ? `/mas?${new URLSearchParams({ buscar: previousQuery })}` : '/mas'
  return <div className={`workspace min-h-screen bg-paper text-ink dark:bg-night dark:text-paper ${docked ? "workspace--more-pinned" : ""}`}>
    <a href="#contenido-panel" className="workspace-skip">Saltar al contenido</a>
    <header className="workspace-header">
      <div className="workspace-top">
        <Link to={staffHome(user.role)} onClick={e => follow(e, staffHome(user.role))} className="workspace-brand" aria-label="Panel TecRuta — inicio"><span className="workspace-mark">TR</span><span>TecRuta <small>Panel de trabajo</small></span></Link>
        <div className="workspace-account"><ThemeToggle /><details ref={account} onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus() } }}>
          <summary aria-label="Mi cuenta" className="workspace-account-trigger"><span className="workspace-avatar" aria-hidden="true">{user.nombre?.slice(0, 1)}</span><span className="hidden sm:block"><strong>{user.nombre}</strong><small>{panelRoleName[user.role]}</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="workspace-account-menu"><p>{user.nombre} {user.apellido}<small>{panelRoleName[user.role]}</small></p><Link to="/seguridad" onClick={e => follow(e, '/seguridad')}><ShieldCheck size={17} />Contraseña y seguridad</Link><a href={STORE_ORIGIN} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} />Ver tienda pública</a><button type="button" onClick={() => { if (!beforeLeave || beforeLeave('/iniciar-sesion')) { logout(); navigate('/iniciar-sesion', { replace: true }) } }}><LogOut size={17} />Cerrar sesión</button></div>
        </details></div>
      </div>
      <nav aria-label="Secciones del panel" className="workspace-navigation">{primaryNavigation(user.role).map(item => { const Icon = icons[item.icon], active = isPrimaryActive(item.to, location.pathname, user.role); return item.to === '/mas' ? <button ref={moreTrigger} key={item.to} type="button" aria-haspopup="dialog" aria-expanded={moreOpen || docked} data-active={active || undefined} onClick={() => { if (account.current) account.current.open = false; if (docked) document.querySelector('.workspace-more input[type="search"]')?.focus(); else setMoreOpen(value => !value) }}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></button> : <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} onClick={e => follow(e, item.to)}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></Link> })}</nav>
    </header>
    {user.role === 'ADMIN' && <WorkspaceMore open={moreOpen} pinned={morePinned} desktop={desktop} query={moreQuery} setQuery={setMoreQuery} setPinned={value => { setMoreOpen(true); setMorePinned(value) }} close={closeMore} pathname={location.pathname} follow={follow} />}
    <div className="workspace-content">{showBack && <Link to={backTo} onClick={e => follow(e, backTo)} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-paper-line bg-white px-4 py-2 text-sm font-semibold hover:border-route dark:border-night-line dark:bg-night-surface"><ArrowLeft size={18} aria-hidden="true" />Volver a Más</Link>}{children}</div>
  </div>
}
