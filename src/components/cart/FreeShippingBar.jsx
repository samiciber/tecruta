import React from 'react'
import { Truck } from 'lucide-react'
import { useSiteSettings } from '../../hooks/useSiteContent.js'

// Only display an explicitly configured shipping policy; never infer free shipping.
export default function FreeShippingBar() {
  const { settings } = useSiteSettings()
  const shipping = settings.storeBusiness?.shippingText?.trim()
  if (!shipping) return null
  return (
    <div className="rounded-xl2 border border-paper-line bg-paper p-3 dark:border-night-line dark:bg-night">
      <div className="flex items-start gap-2 text-xs font-medium text-ink dark:text-paper">
        <Truck className="h-4 w-4 shrink-0 text-route" aria-hidden="true" />
        <span className="whitespace-pre-line">{shipping}</span>
      </div>
    </div>
  )
}
