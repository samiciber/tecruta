import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Moon, Store, Sun, User, X } from 'lucide-react'
import EntryList from './header/EntryList.jsx'
import { buildMenuEntries, navToEntries } from './header/entries.js'
import { useBrands, useCategoryTree, useNav, useSiteSettings } from '../../hooks/useSiteContent.js'
import { useSelectedStore, StoreDetails } from './header/StoreMenu.jsx'
import { usePanelBehavior } from '../../hooks/usePanel.js'
import { useTheme } from '../../hooks/useTheme.js'
import { useAuth } from '../../hooks/useAuth.js'

// Panel lateral móvil con navegación por niveles y botón «Atrás».
// Acceso rápido a Cuenta, Tu tienda y Modo oscuro.
export default function MobileMenu({ open, onClose }) {
  const ref = useRef(null)
  const { menus } = useNav()
  const { tree } = useCategoryTree()
  const { featured } = useBrands()
  const { settings } = useSiteSettings()
  const { store, stores, select } = useSelectedStore()
  const { theme, toggleTheme } = useTheme()
  const { user, isAuthenticated } = useAuth()
  const [stack, setStack] = useState([])
  const [storeOpen, setStoreOpen] = useState(false)

  usePanelBehavior({ open, onClose, containerRef: ref, trap: true })

  useEffect(() => {
    if (!open) { setStack([]); setStoreOpen(false); return undefined }
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  const root = useMemo(() => {
    const cats = buildMenuEntries({ tree, featured, layout: settings.menuLayout, texts: settings.menuTexts })
    const nav = (title, items) => ({ kind: 'next', label: title, next: { title, entries: navToEntries(items) } })
    return [
      { kind: 'heading', label: 'Comprar' },
      ...cats,
      ...(cats.length === 0 ? [{ kind: 'link', label: 'Todos los productos', to: '/catalogo' }] : []),
      { kind: 'heading', label: 'Más en TecRuta' },
      nav('Ofertas', menus.acuerdos),
      nav('Soporte y Servicios', menus.soporte),
      nav('Descubre', menus.descubre),
      nav('Más', menus.mas),
    ]
  }, [tree, featured, menus, settings.menuLayout, settings.menuTexts])

  if (!open) return null
  const level = stack[stack.length - 1] || { title: 'Menú', entries: root }

  return (
    <div className="fixed inset-0 z-[95] isolate lg:hidden">
      <button type="button" tabIndex={-1} aria-label="Cerrar menú" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Menú de navegación" className="absolute left-0 top-0 flex h-dvh w-[88%] max-w-sm flex-col bg-white text-ink shadow-2xl dark:bg-night-surface dark:text-paper">
        <div className="flex items-center gap-2 bg-header px-3 py-3 text-white">
          {stack.length > 0 ? (
            <button type="button" onClick={() => setStack((s) => s.slice(0, -1))} className="flex items-center gap-1 rounded px-1 py-1 text-sm font-bold hover:bg-white/10">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Atrás
            </button>
          ) : (
            <span className="px-1 text-base font-bold">Menú</span>
          )}
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="ml-auto rounded p-1.5 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {stack.length > 0 && <h2 className="px-5 pb-1 pt-4 text-lg font-bold">{level.title}</h2>}
          {level.empty ? (
            <p className="px-5 py-4 text-sm text-ink-soft dark:text-paper/60">Próximamente.</p>
          ) : (
            <EntryList entries={level.entries} onNavigate={onClose} onNext={(e) => setStack((s) => [...s, e.next])} label={level.title} />
          )}
        </div>

        <div className="border-t border-gray-200 pb-[env(safe-area-inset-bottom)] dark:border-night-line">
          <Link to={isAuthenticated ? '/mi-cuenta' : '/iniciar-sesion'} onClick={onClose} className="flex items-center gap-3 px-5 py-3 text-[15px] hover:bg-gray-100 dark:hover:bg-white/10">
            <User className="h-5 w-5" aria-hidden="true" />
            <span className="flex-1">{isAuthenticated ? `Cuenta · ${user.nombre}` : 'Iniciar sesión / Crear cuenta'}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button type="button" aria-expanded={storeOpen} onClick={() => setStoreOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-3 text-left text-[15px] hover:bg-gray-100 dark:hover:bg-white/10">
            <Store className="h-5 w-5" aria-hidden="true" />
            <span className="flex-1">Tu tienda: <strong>{store?.name ?? 'Tienda online'}</strong></span>
          </button>
          {storeOpen && <StoreDetails store={store} stores={stores} onSelect={select} onClose={() => setStoreOpen(false)} />}
          <button type="button" onClick={toggleTheme} aria-pressed={theme === 'dark'} className="flex w-full items-center gap-3 px-5 py-3 text-left text-[15px] hover:bg-gray-100 dark:hover:bg-white/10">
            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            <span className="flex-1">Modo {theme === 'dark' ? 'claro' : 'oscuro'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
