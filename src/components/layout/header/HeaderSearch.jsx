import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { usePanelBehavior } from '../../../hooks/usePanel.js'
import { usePopularSearches, useBrands, useCategoryTree } from '../../../hooks/useSiteContent.js'
import { useProductIndex } from '../../../hooks/useProductIndex.js'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const MAX_CHIPS = 10

function flatten(tree, out = []) {
  for (const n of tree) {
    out.push(n)
    flatten(n.children || [], out)
  }
  return out
}

function shuffle(list) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function HeaderSearch({ open, onOpen, onClose, idPrefix = 'search' }) {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [active, setActive] = useState(-1)
  const [seed, setSeed] = useState(0)
  const { searches } = usePopularSearches()
  const { all: brands } = useBrands()
  const { tree } = useCategoryTree()
  const { index: products } = useProductIndex({ enabled: open && value.trim().length >= 2 })

  usePanelBehavior({ open, onClose, containerRef: wrapRef, trap: false, autoFocus: false, restoreFocus: false })

  const chips = useMemo(() => (seed === 0 ? searches : shuffle(searches)).slice(0, MAX_CHIPS), [searches, seed])

  const q = norm(value.trim())
  const suggestions = useMemo(() => {
    if (q.length < 2) return []
    const out = []
    products.filter((p) => norm(p.name).includes(q)).slice(0, 5).forEach((p) => out.push({ key: `p-${p.id}`, kind: 'Producto', label: p.name, to: `/producto/${p.slug}`, image: p.image }))
    brands.filter((b) => norm(b.name).includes(q)).slice(0, 2).forEach((b) => out.push({ key: `b-${b.id}`, kind: 'Marca', label: b.name, to: `/marca/${b.slug}` }))
    flatten(tree).filter((c) => norm(c.name).includes(q)).slice(0, 2).forEach((c) => out.push({ key: `c-${c.id}`, kind: 'Categoría', label: c.name, to: `/categoria/${c.slug}` }))
    return out
  }, [q, products, brands, tree])

  useEffect(() => setActive(-1), [q])

  const go = (to) => {
    setValue('')
    onClose()
    inputRef.current?.blur()
    navigate(to)
  }
  // Chip de búsqueda popular: es un enlace real (clic medio, «abrir en pestaña
  // nueva» y teclado funcionan solos). En un clic normal: pone el texto en el
  // input, cierra el panel y deja que <Link> navegue a /catalogo?q=…
  const onChipClick = (e, text) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return // el navegador abre otra pestaña
    setValue(text)
    onClose()
    inputRef.current?.blur()
  }
  // Los enlaces no se activan con Espacio; los chips sí (además de Enter).
  const onChipKeyDown = (e) => {
    if (e.key === ' ') {
      e.preventDefault()
      e.currentTarget.click()
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (active >= 0 && suggestions[active]) return go(suggestions[active].to)
    go(value.trim() ? `/catalogo?q=${encodeURIComponent(value.trim())}` : '/catalogo')
  }
  const onKeyDown = (e) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1)) }
  }

  const listId = `${idPrefix}-panel`
  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <form onSubmit={submit} role="search" className="flex h-11 overflow-hidden rounded-md bg-white shadow-sm">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${idPrefix}-opt-${active}` : undefined}
          aria-label="Buscar en TecRuta"
          autoComplete="off"
          value={value}
          onFocus={onOpen}
          onClick={onOpen}
          onKeyDown={onKeyDown}
          onChange={(e) => { setValue(e.target.value); onOpen() }}
          placeholder="Busca en TecRuta"
          className="min-w-0 flex-1 bg-white px-4 text-[15px] text-ink placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-header"
        />
        <button type="submit" aria-label="Buscar" className="flex w-12 items-center justify-center bg-gray-100 text-ink hover:bg-gray-200">
          <Search className="h-5 w-5" />
        </button>
      </form>

      {open && (
        <div id={listId} className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg bg-white p-4 text-ink shadow-2xl dark:bg-night-surface dark:text-paper">
          {suggestions.length > 0 ? (
            <ul role="listbox" aria-label="Sugerencias">
              {suggestions.map((s, i) => (
                <li key={s.key} id={`${idPrefix}-opt-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(s.to)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/10 ${i === active ? 'bg-gray-100 dark:bg-white/10' : ''}`}
                  >
                    {s.image ? <img src={s.image} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="shrink-0 text-xs text-ink-soft dark:text-paper/50">{s.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : q.length >= 2 ? (
            <p className="text-sm text-ink-soft dark:text-paper/70">Sin sugerencias para «{value.trim()}». Pulsa Enter para buscar en el catálogo.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-body text-base font-bold">Búsquedas populares</h2>
                {searches.length > 0 && (
                  <button type="button" onClick={() => setSeed((n) => n + 1)} className="text-sm font-bold text-header hover:underline dark:text-sky-300">
                    Actualizar
                  </button>
                )}
              </div>
              {chips.length === 0 ? (
                <p className="text-sm text-ink-soft dark:text-paper/70">Escribe para buscar productos, marcas o categorías.</p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-2">
                  {chips.map((c) => (
                    <li key={c.id} className="shrink-0">
                      <Link
                        to={`/catalogo?q=${encodeURIComponent(c.text)}`}
                        onClick={(e) => onChipClick(e, c.text)}
                        onKeyDown={onChipKeyDown}
                        className="block whitespace-nowrap rounded-full border border-gray-400 px-4 py-2 text-sm hover:bg-gray-100 dark:border-night-line dark:hover:bg-white/10"
                      >
                        {c.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}