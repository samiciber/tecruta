import React from 'react'
import { useCategories } from '../../hooks/useCategories.js'
import { formatCurrency } from '../../utils/formatCurrency.js'

const CATEGORIAS_CON_STOCK = ['power-banks', 'cargadores', 'cables', 'audifonos', 'accesorios']

export default function FilterPanel({ filters, onChange, onClear, brands, priceBounds }) {
  const { categories } = useCategories()
  const activeCategories = categories.filter((c) => CATEGORIAS_CON_STOCK.includes(c.slug))
  const { category, brands: selectedBrands = [], minPrice, maxPrice, inStockOnly } = filters

  const toggleBrand = (brand) => {
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand]
    onChange({ ...filters, brands: next })
  }

  const hasActiveFilters =
    Boolean(category) ||
    selectedBrands.length > 0 ||
    typeof minPrice === 'number' ||
    typeof maxPrice === 'number' ||
    Boolean(inStockOnly)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink dark:text-paper">Filtros</h3>
        {hasActiveFilters && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-route hover:underline">
            Limpiar todo
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">
          Categoría
        </legend>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...filters, category: undefined })}
            className={`rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
              !category ? 'bg-route-soft text-route dark:bg-route-softDark' : 'text-ink-soft hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10'
            }`}
          >
            Todas las categorías
          </button>
          {activeCategories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => onChange({ ...filters, category: c.slug })}
              className={`rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                category === c.slug ? 'bg-route-soft text-route dark:bg-route-softDark' : 'text-ink-soft hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">
          Marca
        </legend>
        <div className="flex flex-col gap-2">
          {brands.map((brand) => (
            <label key={brand} className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/70">
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={() => toggleBrand(brand)}
                className="h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line"
              />
              {brand}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">
          Precio
        </legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder={formatCurrency(priceBounds.min)}
            value={minPrice ?? ''}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })}
            className="input-tr py-2 text-sm"
            aria-label="Precio mínimo"
          />
          <span className="text-ink-soft/50">–</span>
          <input
            type="number"
            min={0}
            placeholder={formatCurrency(priceBounds.max)}
            value={maxPrice ?? ''}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })}
            className="input-tr py-2 text-sm"
            aria-label="Precio máximo"
          />
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/70">
        <input
          type="checkbox"
          checked={Boolean(inStockOnly)}
          onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked })}
          className="h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line"
        />
        Solo disponibles
      </label>
    </div>
  )
}