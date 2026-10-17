import React, { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, ExternalLink } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { STORE_ORIGIN, staffHome } from '../../app/urls.js'

const TABS = [
  ['/', 'Resumen'], ['/inventario', 'Inventario'], ['/pos', 'Punto de venta'],
  ['/productos', 'Productos'], ['/pedidos', 'Pedidos'], ['/usuarios', 'Usuarios y permisos'],
  ['/clientes', 'Clientes'], ['/categorias', 'Categorías'], ['/asignar', 'Asignar productos'],
  ['/pagos', 'Métodos de pago'], ['/marcas', 'Marcas'], ['/busquedas', 'Búsquedas populares'],
  ['/tiendas', 'Tiendas'], ['/menu', 'Menú'], ['/menus', 'Menús de navegación'],
  ['/banners', 'Banners del Home'], ['/circulos', 'Círculos de la Home'],
  ['/home-layout', 'Diseño del Home'], ['/footer', 'Footer y legales'],
  ['/suscriptores', 'Suscriptores'], ['/ajustes', 'Ajustes del sitio'],
]
const roleName = { ADMIN: 'Administrador', CASHIER: 'Cajero', WAREHOUSE: 'Almacén' }
export default function AdminLayout() {
  const { user, logout } = useAuth(), location = useLocation(), navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const isAdmin = user?.role === 'ADMIN'
  if (user && !isAdmin && location.pathname !== '/inventario') return <Navigate to={staffHome(user.role)} replace />
  const tabs = TABS.filter(([to]) => isAdmin || to === '/inventario' || user?.role === 'CASHIER' && to === '/pos')
  return <div className="lg:grid lg:min-h-screen lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="border-b border-paper-line bg-white dark:border-night-line dark:bg-night-surface lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-5"><NavLink to="/" className="font-display text-xl font-bold">Panel <span className="text-route">TecRuta</span></NavLink><button aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'} className="mr-12 rounded p-2 lg:hidden" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button></div>
      <div className="px-5 pb-4"><p className="truncate text-sm font-semibold">{user?.nombre} {user?.apellido}</p><p className="text-xs text-ink-soft dark:text-paper/60">{roleName[user?.role]}</p></div>
      <nav aria-label="Secciones del panel" className={(open ? 'block' : 'hidden') + ' space-y-1 px-3 pb-4 lg:block'}>{tabs.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => 'block rounded-lg px-3 py-2.5 text-sm font-medium ' + (isActive ? 'bg-route text-white' : 'text-ink-soft hover:bg-paper dark:text-paper/70 dark:hover:bg-night')}>{label}</NavLink>)}</nav>
      <div className="flex flex-wrap gap-3 border-t border-paper-line px-5 py-4 text-sm dark:border-night-line lg:flex-col"><a className="inline-flex items-center gap-2 text-route" href={STORE_ORIGIN} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Ver tienda</a><button className="inline-flex items-center gap-2 text-left" onClick={() => { logout(); navigate('/iniciar-sesion', { replace: true }) }}><LogOut size={15} />Cerrar sesión</button></div>
    </aside>
    <main id="contenido-panel" className="min-w-0 px-4 py-8 sm:px-6 lg:px-8 lg:pt-16"><Outlet /></main>
  </div>
}
