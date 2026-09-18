import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, Search } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories.js'

export default function MobileMenu({ open, onClose }) {
  const [searchValue, setSearchValue] = useState('')
  const { categories } = useCategories()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const submitSearch = (e) => {
    e.preventDefault()
    navigate(searchValue.trim() ? `/catalogo?q=${encodeURIComponent(searchValue.trim())}` : '/catalogo')
    setSearchValue('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[95] isolate lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
      <button aria-label="Cerrar menú" className="absolute inset-0 bg-ink/40 backdrop-blur-sm dark:bg-black/60" onClick={onClose} />
      <div
        className="fixed left-0 top-0 z-10 flex h-dvh w-full max-w-xs animate-fade-up flex-col overflow-y-auto bg-paper-surface p-5 shadow-2xl dark:bg-night-surface"
        style={{ height: '100dvh' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-ink dark:text-paper">Menú</span>
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="rounded-full p-1.5 text-ink-soft hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submitSearch} className="relative mb-5 shrink-0">
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

        <nav className="flex flex-col gap-1" aria-label="Categorías">
          <Link to="/catalogo" onClick={onClose} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 dark:text-paper dark:hover:bg-paper/10">
            Todos los productos
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/catalogo?categoria=${c.slug}`}
              onClick={onClose}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-ink/5 dark:text-paper/70 dark:hover:bg-paper/10"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}