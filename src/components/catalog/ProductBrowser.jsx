import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react'
import SortSelect from '../filters/SortSelect.jsx'
import FilterPanel from '../filters/FilterPanel.jsx'
import ProductGrid from '../product/ProductGrid.jsx'
import Modal from '../ui/Modal.jsx'
import { useProducts } from '../../hooks/useProducts.js'

const PAGE_SIZE = 24

// Productos ya acotados (por categoría o marca) con los filtros del
// catálogo: marca, precio, disponibilidad, orden y paginación (en la URL).
export default function ProductBrowser({ products, loading = false, hideCategories = true }) {
  const [params, setParams] = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sort = params.get('ordenar') || 'relevance'
  const pagina = Math.max(1, Number(params.get('pagina') || 1))
  const filters = useMemo(
    () => ({
      brands: params.get('marcas') ? params.get('marcas').split(',') : [],
      minPrice: params.get('min') ? Number(params.get('min')) : undefined,
      maxPrice: params.get('max') ? Number(params.get('max')) : undefined,
      inStockOnly: params.get('stock') === '1',
    }),
    [params],
  )

  const results = useProducts(products, { filters, sort })
  const totalPaginas = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const pageItems = results.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].filter(Boolean).sort(), [products])
  const priceBounds = useMemo(
    () => products.reduce((acc, p) => ({ min: Math.min(acc.min, p.price), max: Math.max(acc.max, p.price) }), { min: Infinity, max: 0 }),
    [products],
  )

  const update = (next) => {
    const merged = new URLSearchParams(params)
    const map = { ordenar: next.sort, marcas: next.brands, min: next.minPrice, max: next.maxPrice, stock: next.inStockOnly ? '1' : undefined }
    Object.entries(map).forEach(([key, value]) => {
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) merged.delete(key)
      else merged.set(key, Array.isArray(value) ? value.join(',') : String(value))
    })
    merged.delete('pagina')
    setParams(merged, { replace: true })
  }
  const handleFilterChange = (next) => update({ ...next, sort: sort === 'relevance' ? undefined : sort })
  const clear = () => setParams({}, { replace: true })
  const goTo = (n) => {
    const merged = new URLSearchParams(params)
    merged.set('pagina', String(n))
    setParams(merged, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const panel = <FilterPanel filters={filters} onChange={handleFilterChange} onClear={clear} brands={brands} priceBounds={priceBounds} hideCategories={hideCategories} />

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <p className="text-sm text-ink-soft dark:text-paper/50" aria-live="polite">
          {loading ? 'Cargando productos…' : `${results.length} producto${results.length === 1 ? '' : 's'}`}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setMobileOpen(true)} className="btn-secondary lg:hidden">
            <SlidersHorizontal className="h-4 w-4" /> Filtros
          </button>
          <SortSelect value={sort} onChange={(v) => update({ ...filters, sort: v === 'relevance' ? undefined : v })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-40">{panel}</div>
        </aside>
        <div>
          <ProductGrid
            products={pageItems}
            loading={loading}
            emptyAction={
              <button type="button" onClick={clear} className="btn-secondary mt-2">
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
            }
          />
          {!loading && totalPaginas > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Paginación">
              <button type="button" disabled={paginaSegura <= 1} onClick={() => goTo(paginaSegura - 1)} className="btn-secondary disabled:pointer-events-none disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <span className="text-sm text-ink-soft dark:text-paper/60">Página {paginaSegura} de {totalPaginas}</span>
              <button type="button" disabled={paginaSegura >= totalPaginas} onClick={() => goTo(paginaSegura + 1)} className="btn-secondary disabled:pointer-events-none disabled:opacity-30">
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>

      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title="Filtros">
        {panel}
        <button type="button" onClick={() => setMobileOpen(false)} className="btn-primary mt-6 w-full">
          Ver {results.length} resultado{results.length === 1 ? '' : 's'}
        </button>
      </Modal>
    </div>
  )
}