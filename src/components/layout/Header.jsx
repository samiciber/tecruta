import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronUp, Menu as MenuIcon, ShoppingCart } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import AccountMenu from './AccountMenu.jsx'
import MobileMenu from './MobileMenu.jsx'
import HeaderSearch from './header/HeaderSearch.jsx'
import StoreMenu from './header/StoreMenu.jsx'
import MenuPanel from './header/MenuPanel.jsx'
import NavPanel from './header/NavPanel.jsx'
import { useNav } from '../../hooks/useSiteContent.js'
import { useCart } from '../../hooks/useCart.js'
import { storeConfig } from '../../config/storeConfig.js'

// Pasa a ocultarse al bajar (solo escritorio) después de estos píxeles.
const HIDE_SCROLL_THRESHOLD = 120

// Contenedor ÚNICO compartido por las dos filas: mismo padding lateral y el
// mismo tope (muy alto, no un ancho centrado y estrecho). Así el borde
// izquierdo (logo = primera píldora) y el derecho (carrito = «Más ▾»)
// coinciden en cualquier ancho.
const WRAP = 'mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8 xl:px-11'

// Prioridad de los enlaces rápidos según el ancho (CSS, sin medir con JS).
// Cada umbral es el ancho mínimo en el que ese enlace CABE sin desbordar la
// fila 2 con los textos por defecto; lo que no cabe sigue en «Más ▾».
const QUICK_VISIBILITY = [
  'hidden min-[1400px]:block', // promo de temporada (texto largo, editable)
  '', // Mejores ofertas
  'hidden min-[1100px]:block',
  'hidden min-[1180px]:block',
  'hidden min-[1640px]:block',
  'hidden min-[1780px]:block',
  'hidden min-[1900px]:block',
]

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 rounded" aria-label={`${storeConfig.name} — inicio`}>
      <svg width="32" height="32" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <rect width="30" height="30" rx="8" fill="#fff" />
        <path d="M7 19 L13 11 L17 16 L23 8" stroke="#0046BE" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="23" cy="8" r="1.8" fill="#0046BE" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight text-white">
        Tec<span className="text-cta">Ruta</span>
      </span>
    </Link>
  )
}

function Pill({ id, label, panel, onToggle, children }) {
  const open = panel === id
  const ref = useRef(null)
  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`panel-${id}`}
        onClick={() => onToggle(id)}
        className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[15px] font-semibold text-white transition-colors ${
          open ? 'border-white bg-white/20' : 'border-white/40 hover:bg-white/10'
        }`}
      >
        {label}
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && children(ref)}
    </div>
  )
}

export default function Header() {
  const [panel, setPanel] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const { itemCount } = useCart()
  const { menus } = useNav()
  const location = useLocation()
  const lastY = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const panelRef = useRef(null)
  panelRef.current = panel

  const close = useCallback(() => setPanel(null), [])
  const toggle = useCallback((id) => setPanel((p) => (p === id ? null : id)), [])
  const moreRef = useRef(null)

  // Cierra paneles al navegar y muestra el header.
  useEffect(() => {
    setPanel(null)
    setMobileOpen(false)
    setHidden(false)
    lastY.current = window.scrollY
  }, [location.pathname, location.search])

  // Comportamiento aprobado: se oculta al bajar y reaparece al subir
  // (solo escritorio; sticky ocupa su espacio, no hace falta compensar
  // con padding). Nunca se oculta con un panel abierto.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (panelRef.current) {
        lastY.current = y
        return
      }
      if (y <= HIDE_SCROLL_THRESHOLD) setHidden(false)
      else if (y > lastY.current) setHidden(true)
      else if (y < lastY.current) setHidden(false)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const cartLabel = `Carrito de compras, ${itemCount} producto${itemCount === 1 ? '' : 's'}`
  const cartIcon = (
    <Link to="/carrito" aria-label={cartLabel} className="relative -mr-2.5 flex h-11 w-11 items-center justify-center rounded text-white hover:bg-white/10">
      <ShoppingCart className="h-6 w-6" aria-hidden="true" />
      {itemCount > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cta px-1 text-[11px] font-bold text-ink">{itemCount}</span>
      )}
    </Link>
  )

  return (
    <header className={`sticky top-0 z-50 text-white transition-transform duration-300 ${hidden ? 'lg:-translate-y-full' : ''}`}>
      {/* Capas (de abajo arriba): página < velo < fila 2 < fila 1.
          - Paneles de la fila 2 (Menú, Acuerdos…): velo en z-0, bajo ambas filas,
            para que su botón y su panel queden nítidos.
          - Buscador abierto: el velo sube a z-[15], entre la fila 2 (z-10) y la
            fila 1 (z-20): oscurece la página Y la fila 2; el campo y su panel
            (hijos de la fila 1) quedan por encima, completos. */}
      {panel && <div aria-hidden="true" className={`fixed inset-0 bg-black/50 ${panel === 'search' ? 'z-[15]' : 'z-0'}`} onClick={close} />}

      {/* Fila 1 */}
      <div className="relative z-20 bg-header">
        <div className={`${WRAP} flex h-14 items-center gap-3 lg:h-16 lg:gap-5 xl:gap-6`}>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú" aria-haspopup="dialog" className="-ml-2 rounded p-2 hover:bg-white/10 lg:hidden">
            <MenuIcon className="h-6 w-6" />
          </button>
          <Logo />

          <div className="hidden min-w-0 flex-1 lg:flex">
            <HeaderSearch open={panel === 'search'} onOpen={() => setPanel('search')} onClose={close} idPrefix="search-d" />
          </div>

          <div className="hidden shrink-0 items-center gap-3 lg:flex xl:gap-4">
            <StoreMenu open={panel === 'store'} onToggle={() => toggle('store')} onClose={close} />
            <ThemeToggle onBlue />
            <AccountMenu open={panel === 'account'} onToggle={() => toggle('account')} onClose={close} />
            <span aria-hidden="true" className="h-7 w-px bg-white/30" />
            {cartIcon}
          </div>
          <div className="ml-auto lg:hidden">{cartIcon}</div>
        </div>

        {/* Buscador en móvil: segunda línea */}
        <div className={`${WRAP} pb-3 lg:hidden`}>
          <div className="flex">
            <HeaderSearch open={panel === 'search'} onOpen={() => setPanel('search')} onClose={close} idPrefix="search-m" />
          </div>
        </div>
      </div>

      {/* Fila 2 (solo escritorio) */}
      <nav aria-label="Navegación principal" className="relative z-10 hidden border-t border-white/20 bg-header-band lg:block">
        <div className={`${WRAP} flex h-[54px] items-center gap-2.5`}>
          <Pill id="menu" label="Menú" panel={panel} onToggle={toggle}>
            {(ref) => <MenuPanel triggerRef={ref} onClose={close} />}
          </Pill>
          <Pill id="acuerdos" label="Acuerdos" panel={panel} onToggle={toggle}>
            {(ref) => <NavPanel id="panel-acuerdos" title="Acuerdos" items={menus.acuerdos} width="w-[22rem]" triggerRef={ref} onClose={close} />}
          </Pill>
          <Pill id="soporte" label="Soporte y Servicios" panel={panel} onToggle={toggle}>
            {(ref) => <NavPanel id="panel-soporte" title="Soporte y Servicios" items={menus.soporte} width="w-[26rem]" triggerRef={ref} onClose={close} />}
          </Pill>
          <Pill id="descubre" label="Descubre" panel={panel} onToggle={toggle}>
            {(ref) => <NavPanel id="panel-descubre" title="Descubre" items={menus.descubre} width="w-[22rem]" triggerRef={ref} onClose={close} />}
          </Pill>

          <ul className="ml-auto flex min-w-0 items-center gap-6 text-sm">
            {menus.quick.map((it, i) => (
              <li key={it.id} className={QUICK_VISIBILITY[i] ?? 'hidden 2xl:block'}>
                <Link to={it.href || '/proximamente'} className="whitespace-nowrap rounded px-1 py-1 hover:underline">
                  {it.label}
                </Link>
              </li>
            ))}
            <li className="relative">
              <button
                ref={moreRef}
                type="button"
                aria-haspopup="true"
                aria-expanded={panel === 'mas'}
                aria-controls="panel-mas"
                onClick={() => toggle('mas')}
                className="flex items-center gap-1 rounded py-1 pl-1 hover:underline"
              >
                Más {panel === 'mas' ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              </button>
              {panel === 'mas' && <NavPanel id="panel-mas" title="Más" items={menus.mas} width="w-[20rem]" align="right" triggerRef={moreRef} onClose={close} />}
            </li>
          </ul>
        </div>
      </nav>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  )
}