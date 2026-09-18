import React from 'react'

const OPTIONS = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'discount', label: 'Mayor descuento' },
]

export default function SortSelect({ value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-soft dark:text-paper/60 sm:inline">Ordenar por</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-tr w-auto cursor-pointer py-2"
        aria-label="Ordenar productos"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
