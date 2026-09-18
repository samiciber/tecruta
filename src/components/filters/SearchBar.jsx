import React from 'react'
import { Search, X } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Buscar productos…', autoFocus = false, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/50 dark:text-paper/40" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar productos"
        className="input-tr pl-10 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/50 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
