import React from 'react'
import { Truck, CheckCircle2 } from 'lucide-react'
import { storeConfig } from '../../config/storeConfig.js'
import { formatCurrency } from '../../utils/formatCurrency.js'

export default function FreeShippingBar({ subtotal }) {
  const threshold = storeConfig.freeShipping?.threshold
  if (!threshold) return null

  const reached = subtotal >= threshold
  const percent = Math.min(100, Math.round((subtotal / threshold) * 100))
  const remaining = threshold - subtotal

  return (
    <div className="rounded-xl2 border border-paper-line bg-paper p-3 dark:border-night-line dark:bg-night">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        {reached ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-signal-green" />
            <span className="text-signal-green">¡Envío gratis desbloqueado!</span>
          </>
        ) : (
          <>
            <Truck className="h-4 w-4 text-route" />
            <span className="text-ink dark:text-paper">
              Te faltan <span className="font-semibold">{formatCurrency(remaining)}</span> para envío gratis
            </span>
          </>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-line dark:bg-night-line">
        <div
          className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-signal-green' : 'bg-route'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}