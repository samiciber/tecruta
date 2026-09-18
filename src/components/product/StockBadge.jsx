import React from 'react'

export default function StockBadge({ stock, lowStockThreshold = 5, className = '' }) {
  if (stock <= 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-signal-red/10 px-2.5 py-1 text-xs font-medium text-signal-red ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-signal-red" />
        Agotado
      </span>
    )
  }
  if (stock <= lowStockThreshold) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-signal-amber/10 px-2.5 py-1 text-xs font-medium text-signal-amber ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" />
        Pocas unidades
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-signal-green/10 px-2.5 py-1 text-xs font-medium text-signal-green ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />
      Disponible
    </span>
  )
}
