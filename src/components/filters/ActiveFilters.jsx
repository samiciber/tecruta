import React from 'react'
import { X } from 'lucide-react'
import { ATTRIBUTE_LABELS } from '../../utils/catalogFilters.js'
export default function ActiveFilters({ filters, categoryName, onChange }) {
  const chips = []
  if (filters.category)
    chips.push({
      label: categoryName || filters.category,
      remove: () => onChange({ ...filters, category: undefined, attributes: {} }),
    })
  for (const brand of filters.brands || [])
    chips.push({
      label: brand,
      remove: () => onChange({ ...filters, brands: filters.brands.filter((v) => v !== brand) }),
    })
  for (const [key, values] of Object.entries(filters.attributes || {}))
    for (const value of values)
      chips.push({
        label: `${ATTRIBUTE_LABELS[key]}: ${value}`,
        remove: () =>
          onChange({
            ...filters,
            attributes: { ...filters.attributes, [key]: values.filter((v) => v !== value) },
          }),
      })
  if (!chips.length) return null
  return (
    <div aria-label="Filtros seleccionados" className="mb-4 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.remove}
          aria-label={`Quitar filtro ${chip.label}`}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-route/30 bg-route-soft px-3 py-1.5 text-xs font-semibold text-route dark:bg-route-softDark"
        >
          <span className="break-words">{chip.label}</span>
          <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </button>
      ))}
    </div>
  )
}
