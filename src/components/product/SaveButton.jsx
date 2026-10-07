import React from 'react'
import { Heart } from 'lucide-react'
import { useSaved } from '../../hooks/useSaved.js'

// Corazón de «Elementos guardados». variant="overlay" va sobre la imagen de
// la tarjeta; variant="button" es el botón de la ficha de producto.
export default function SaveButton({ product, variant = 'overlay', className = '' }) {
  const { isSaved, toggle } = useSaved()
  const saved = isSaved(product.id)
  const label = saved ? `Quitar ${product.name} de elementos guardados` : `Guardar ${product.name}`

  if (variant === 'button') {
    return (
      <button type="button" onClick={() => toggle(product)} aria-pressed={saved} className={`btn-secondary ${className}`}>
        <Heart className={`h-4 w-4 ${saved ? 'fill-signal-red text-signal-red' : ''}`} aria-hidden="true" />
        {saved ? 'Guardado' : 'Guardar'}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(product)
      }}
      aria-pressed={saved}
      aria-label={label}
      className={`absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white dark:bg-night/80 dark:text-paper ${className}`}
    >
      <Heart className={`h-[18px] w-[18px] ${saved ? 'fill-signal-red text-signal-red' : ''}`} aria-hidden="true" />
    </button>
  )
}