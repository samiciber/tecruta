import React from 'react'

// Piezas pequeñas compartidas por las pantallas de admin nuevas.

export function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${className}`}>
      <span className="font-medium text-ink-soft dark:text-paper/60">{label}</span>
      {children}
    </label>
  )
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft dark:text-paper/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line"
      />
      {label}
    </label>
  )
}

export function SectionHeader({ id, title, description, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id={id} className="font-display text-lg font-bold text-ink dark:text-paper">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft dark:text-paper/60">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function EmptyRow({ children }) {
  return (
    <p className="rounded-xl2 border border-dashed border-paper-line p-6 text-center text-sm text-ink-soft dark:border-night-line dark:text-paper/60">
      {children}
    </p>
  )
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}