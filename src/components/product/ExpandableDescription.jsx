import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Recibe la descripción como texto plano (puede tener líneas con
// viñetas "• Título: detalle"). Si el proveedor no escribió múltiples
// líneas, simplemente se muestra el texto completo sin botón de expandir.
export default function ExpandableDescription({ description }) {
  const [expanded, setExpanded] = useState(false)

  if (!description) return null

  const lines = description.split('\n').filter((line) => line.trim() !== '')

  if (lines.length <= 2) {
    return (
      <div className="space-y-2 text-sm leading-relaxed text-ink-soft dark:text-paper/60">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    )
  }

  const visibleLines = expanded ? lines : lines.slice(0, 2)

  return (
    <div>
      <div className="relative space-y-2 text-sm leading-relaxed text-ink-soft dark:text-paper/60">
        {visibleLines.map((line, i) => {
          const colonIndex = line.indexOf(':')
          if (colonIndex !== -1) {
            const title = line.slice(0, colonIndex + 1)
            const rest = line.slice(colonIndex + 1)
            return (
              <p key={i}>
                <strong className="font-semibold text-ink dark:text-paper">{title}</strong>
                {rest}
              </p>
            )
          }
          return <p key={i}>{line}</p>
        })}
        {!expanded && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-paper-surface to-transparent dark:from-night-surface" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-route hover:underline"
      >
        {expanded ? 'Ver menos' : 'Más información'}
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}