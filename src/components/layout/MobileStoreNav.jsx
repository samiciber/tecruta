import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, LayoutGrid, ShoppingCart, User } from 'lucide-react'
import { useCart } from '../../hooks/useCart.js'

export default function MobileStoreNav() {
  const { itemCount } = useCart()
  const { pathname } = useLocation()
  if (pathname === '/checkout' || /^\/(admin|pos|panel)(\/|$)/.test(pathname)) return null
  const items = [
    { to: '/', name: 'Inicio', icon: Home, end: true },
    { to: '/categorias', name: 'Categorías', icon: LayoutGrid, category: true },
    { to: '/carrito', name: 'Carrito', icon: ShoppingCart, count: itemCount },
    { to: '/mi-cuenta', name: 'Cuenta', icon: User },
  ]
  return <nav className="store-mobile-nav" aria-label="Navegación móvil de la tienda">
    {items.map(({ to, name, icon: Icon, end, count, category }) => <NavLink key={to} to={to} end={end}
      className={({ isActive }) => isActive || (category && pathname.startsWith('/categoria/')) ? 'is-active' : undefined}
      aria-label={name === 'Carrito' ? `Carrito, ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}` : name}>
      <span className="store-mobile-nav-icon"><Icon width="20" height="20" aria-hidden="true"/>{count > 0 && <span className="store-mobile-counter" aria-hidden="true">{count > 99 ? '99+' : count}</span>}</span>
      <span>{name}</span>
    </NavLink>)}
  </nav>
}
