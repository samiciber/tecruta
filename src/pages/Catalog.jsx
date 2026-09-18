import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react'
import SearchBar from '../components/filters/SearchBar.jsx'
import SortSelect from '../components/filters/SortSelect.jsx'
import FilterPanel from '../components/filters/FilterPanel.jsx'
import ProductGrid from '../components/product/ProductGrid.jsx'
import Modal from '../components/ui/Modal.jsx'
import { useProducts } from '../hooks/useProducts.js'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { useCategories } from '../hooks/useCategories.js'

const PAGE_SIZE = 24

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const { index, loading } = useProductIndex()
  const { getCategoryBySlug } = useCategories()

  const query = params.get('q') || ''
  const sort = params.get('ordenar') || 'relevance'
  const categorySlug = params.get('categoria') || undefined
  const pagina = Math.max(1, Number(params.get('pagina') || 1))

  const filters = useMemo(
    () => ({
      category: categorySlug,
      brands: params.get('marcas') ? params.get('marcas').split(',') : [],
      minPrice: params.get('min') ? Number(params.get('min')) : undefined,
      maxPrice: params.get('max') ? Number(params.get('max')) : undefined,
      inStockOnly: params.get('stock') === '1',
    }),
    [params, categorySlug],
  )

  const results = useProducts(index, { query, filters, sort })
  const category = categorySlug ? getCategoryBySlug(categorySlug) : null

  const totalPaginas = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const resultadosPagina = results.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)

  const brands = useMemo(() => [...new Set(index.map((p) => p.brand))].sort(), [index])
  const priceBounds = useMemo(
    () => index.reduce((acc, p) => ({ min: Math.min(acc.min, p.price), max: Math.max(acc.max, p.price) }), { min: Infinity, max: 0 }),
    [index],
  )

  const updateParams = (next) => {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0)) {
        merged.delete(key)
      } else if (Array.isArray(value)) {
        merged.set(key, value.join(','))
      } else {
        merged.set(key, String(value))
      }
    })
    merged.delete('pagina')
    setParams(merged, { replace: true })
  }

  const handleFilterChange = (next) => {
    updateParams({ categoria: next.category, marcas: next.brands, min: next.minPrice, max: next.maxPrice, stock: next.inStockOnly })
  }

  const clearFilters = () => setParams(query ? { q: query } : {}, { replace: true })

  const irAPagina = (n) => {
    const merged = new URLSearchParams(params)
    merged.set('pagina', String(n))
    setParams(merged, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [categorySlug])

  return (
    <div className="container-tr py-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">
          {category ? category.name : query ? `Resultados para "${query}"` : 'Todos los productos'}
        </h1>
        {category?.description && <p className="text-sm text-ink-soft dark:text-paper/60">{category.description}</p>}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={query} onChange={(v) => updateParams({ q: v })} className="sm:max-w-sm" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="btn-secondary lg:hidden">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>
          <SortSelect value={sort} onChange={(v) => updateParams({ ordenar: v })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FilterPanel filters={filters} onChange={handleFilterChange} onClear={clearFilters} brands={brands} priceBounds={priceBounds} />
          </div>
        </aside>

        <div>
          <p className="mb-4 text-sm text-ink-soft dark:text-paper/50">
            {loading ? 'Cargando productos…' : `${results.length} producto${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'}`}
          </p>
          <ProductGrid
            products={resultadosPagina}
            loading={loading}
            emptyAction={
              <button type="button" onClick={clearFilters} className="btn-secondary mt-2">
                <X className="h-4 w-4" />
                Limpiar filtros
              </button>
            }
          />

          {!loading && totalPaginas > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Paginación">
              <button type="button" disabled={paginaSegura <= 1} onClick={() => irAPagina(paginaSegura - 1)} className="btn-secondary disabled:opacity-30 disabled:pointer-events-none">
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-sm text-ink-soft dark:text-paper/60">
                Página {paginaSegura} de {totalPaginas}
              </span>
              <button type="button" disabled={paginaSegura >= totalPaginas} onClick={() => irAPagina(paginaSegura + 1)} className="btn-secondary disabled:opacity-30 disabled:pointer-events-none">
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>

      <Modal open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title="Filtros">
        <FilterPanel filters={filters} onChange={handleFilterChange} onClear={clearFilters} brands={brands} priceBounds={priceBounds} />
        <button type="button" onClick={() => setMobileFiltersOpen(false)} className="btn-primary mt-6 w-full">
          Ver {results.length} resultado{results.length === 1 ? '' : 's'}
        </button>
      </Modal>
    </div>
  )
}