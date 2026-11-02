import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency.js'

function Group({ title, children, selected = 0 }) {
  return (
    <details open className="group border-b border-paper-line pb-4 dark:border-night-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink dark:text-paper [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {selected > 0 && (
            <span className="ml-2 rounded-full bg-route-soft px-2 text-xs text-route dark:bg-route-softDark">
              {selected}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  )
}
function Options({ options, selected, toggle, label }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded
    ? options
    : options.filter((option, i) => i < 6 || selected.includes(option.value))
  return (
    <>
      <div className="space-y-2">
        {shown.map(({ value, count }) => (
          <label
            key={value}
            className={`flex items-start gap-2 text-sm ${!count && !selected.includes(value) ? 'opacity-50' : ''} text-ink-soft dark:text-paper/80`}
          >
            <input
              type="checkbox"
              checked={selected.includes(value)}
              disabled={!count && !selected.includes(value)}
              onChange={() => toggle(value)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-paper-line accent-route dark:border-night-line"
            />
            <span className="min-w-0 flex-1 break-words">{value}</span>
            <span className="text-xs tabular-nums text-ink-soft dark:text-paper/60">{count}</span>
          </label>
        ))}
      </div>
      {options.length > 6 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-route hover:underline"
        >
          {expanded ? 'Ver menos' : `Ver más (${options.length})`}
          <span className="sr-only"> {label}</span>
        </button>
      )}
    </>
  )
}
export default function FilterPanel({
  filters,
  onChange,
  onClear,
  facets,
  priceBounds,
  hideBrands = false,
}) {
  const { category, brands = [], attributes = {}, minPrice, maxPrice, inStockOnly } = filters
  const toggle = (values, value) =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
  const hasActive =
    category ||
    brands.length ||
    Object.values(attributes).some((v) => v.length) ||
    typeof minPrice === 'number' ||
    typeof maxPrice === 'number' ||
    inStockOnly
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-ink dark:text-paper">Filtros</h3>
        {Boolean(hasActive) && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-route hover:underline"
          >
            Limpiar todo
          </button>
        )}
      </div>
      {!hideBrands && facets.brands.length > 0 && (
        <Group title="Marca" selected={brands.length}>
          <Options
            label="marcas"
            options={facets.brands}
            selected={brands}
            toggle={(value) => onChange({ ...filters, brands: toggle(brands, value) })}
          />
        </Group>
      )}
      {facets.categories.length > 0 && (
        <Group title="Categorías" selected={category ? 1 : 0}>
          <button
            type="button"
            aria-pressed={!category}
            onClick={() => onChange({ ...filters, category: undefined, attributes: {} })}
            className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${!category ? 'bg-route-soft font-semibold text-route dark:bg-route-softDark' : 'text-ink-soft dark:text-paper/80'}`}
          >
            Todas las categorías
          </button>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {facets.categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={category === c.slug}
                disabled={!c.count && category !== c.slug}
                onClick={() => onChange({ ...filters, category: c.slug, attributes: {} })}
                style={{ paddingLeft: `${8 + Math.min(c.depth, 3) * 10}px` }}
                className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm disabled:opacity-50 ${category === c.slug ? 'bg-route-soft font-semibold text-route dark:bg-route-softDark' : 'text-ink-soft hover:bg-ink/5 dark:text-paper/80 dark:hover:bg-paper/10'}`}
              >
                <span className="min-w-0 flex-1 break-words">{c.name}</span>
                <span className="text-xs tabular-nums">{c.count}</span>
              </button>
            ))}
          </div>
        </Group>
      )}
      {facets.attributes.map((facet) => (
        <Group key={facet.key} title={facet.label} selected={attributes[facet.key]?.length || 0}>
          <Options
            label={facet.label}
            options={facet.options}
            selected={attributes[facet.key] || []}
            toggle={(value) =>
              onChange({
                ...filters,
                attributes: {
                  ...attributes,
                  [facet.key]: toggle(attributes[facet.key] || [], value),
                },
              })
            }
          />
        </Group>
      ))}
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">
          Precio
        </legend>
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder={formatCurrency(Number.isFinite(priceBounds.min) ? priceBounds.min : 0)}
            value={minPrice ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                minPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="input-tr min-w-0 w-full py-2 text-sm"
            aria-label="Precio mínimo"
          />
          <span className="text-ink-soft/50">–</span>
          <input
            type="number"
            min={0}
            placeholder={formatCurrency(priceBounds.max)}
            value={maxPrice ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="input-tr min-w-0 w-full py-2 text-sm"
            aria-label="Precio máximo"
          />
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/80">
        <input
          type="checkbox"
          checked={Boolean(inStockOnly)}
          onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked })}
          className="h-4 w-4 rounded border-paper-line accent-route dark:border-night-line"
        />
        Solo disponibles
      </label>
    </div>
  )
}
