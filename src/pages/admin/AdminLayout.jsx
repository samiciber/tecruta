import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import RequireAdmin from '../../components/admin/RequireAdmin.jsx'

const TABS = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin/categorias', label: 'Categorías' },
  { to: '/admin/asignar', label: 'Asignar productos' },
  { to: '/admin/pagos', label: 'Métodos de pago' },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/menu', label: 'Menú' },
  { to: '/admin/menus', label: 'Menús de navegación' },
  { to: '/admin/marcas', label: 'Marcas' },
  { to: '/admin/busquedas', label: 'Búsquedas populares' },
  { to: '/admin/tiendas', label: 'Tiendas' },
  { to: '/admin/banners', label: 'Banners del Home' },
  { to: '/admin/ajustes', label: 'Ajustes del sitio' },
]

export default function AdminLayout() {
  return (
    <RequireAdmin>
      <div className="container-tr py-8">
        <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Panel de administración</h1>

        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-paper-line dark:border-night-line">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-route text-route'
                    : 'border-transparent text-ink-soft hover:text-ink dark:text-paper/60 dark:hover:text-paper'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </RequireAdmin>
  )
}