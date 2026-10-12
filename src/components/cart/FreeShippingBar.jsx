import React from 'react'
import { Truck } from 'lucide-react'

// El envío se coordina; no hay una tarifa gratuita confirmada por el total.
export default function FreeShippingBar() {
  return (
    <div className="rounded-xl2 border border-paper-line bg-paper p-3 dark:border-night-line dark:bg-night">
      <div className="flex items-start gap-2 text-xs font-medium text-ink dark:text-paper">
        <Truck className="h-4 w-4 shrink-0 text-route" aria-hidden="true" />
        <span>El costo de envío se coordina según tu ubicación antes de confirmar el pago.</span>
      </div>
    </div>
  )
}
