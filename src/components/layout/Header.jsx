import React, { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, Search, ShoppingCart } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import AccountMenu from './AccountMenu.jsx'
import MobileMenu from './MobileMenu.jsx'
import { useCategories } from '../../hooks/useCategories.js'
import { storeConfig } from '../../config/storeConfig.js'
import { useCart } from '../../hooks/useCart.js'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0" aria-label={`${storeConfig.name} — inicio`}>
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <rect width="30" height="30" rx="8" className="fill-route" />
        <path d="M7 19 L13 11 L17 16 L23 8" stroke="white" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="23" cy="8" r="1.8" fill="white" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-ink dark:text-paper">
        Tec<span className="text-route">Ruta</span>
      </span>
    </Link>
  )
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { itemCount, setIsOpen } = useCart()
  const { categories } = useCategories()
  const navigate = useNavigate()

  const submitSearch = (e) => {
    e.preventDefault()
    navigate(searchValue.trim() ? `/catalogo?q=${encodeURIComponent(searchValue.trim())}` : '/catalogo')
    setSearchValue('')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-paper-line bg-paper/90 backdrop-blur-md dark:border-night-line dark:bg-night/90">
      <div className="container-tr flex h-16 items-center gap-4">
        <button
          type="button"
          className="rounded-full p-2 text-ink-soft hover:bg-ink/5 dark:text-paper/70 dark:hover:bg-paper/10 lg:hidden"
          aria-label="Abrir menú"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        <Logo />

        <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-xs flex-1 md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/50 dark:text-paper/40" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Buscar productos…"
            aria-label="Buscar productos"
            className="input-tr pl-10"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            to="/catalogo"
            className="rounded-full p-2 text-ink-soft hover:bg-ink/5 dark:text-paper/70 dark:hover:bg-paper/10 md:hidden"
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </Link>
          <ThemeToggle />
          <AccountMenu />
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-paper-line text-ink-soft transition-colors hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper"
            aria-label={`Carrito de compras, ${itemCount} producto${itemCount === 1 ? '' : 's'}`}
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-route px-1 text-[11px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <nav
        className="hidden border-t border-paper-line/70 dark:border-night-line/70 lg:block"
        aria-label="Categorías"
      >
        <div className="container-tr flex items-center gap-1 overflow-x-auto py-1.5">
          {categories.map((c) => (
            <NavLink
              key={c.slug}
              to={`/catalogo?categoria=${c.slug}`}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-route-soft text-route dark:bg-route-softDark'
                    : 'text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-paper/10 dark:hover:text-paper'
                }`
              }
            >
              {c.name}
            </NavLink>
          ))}
        </div>
      </nav>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  )
}