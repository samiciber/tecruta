import React from 'react'
import { ShieldCheck, Truck, MessageCircle } from 'lucide-react'

const BADGES = [
  { icon: ShieldCheck, label: 'Pago verificado por WhatsApp' },
  { icon: Truck, label: 'Envío asegurado a todo el Perú' },
  { icon: MessageCircle, label: 'Atención personalizada' },
]

export default function TrustBadges() {
  return (
    <div className="flex flex-col gap-2 rounded-xl2 border border-paper-line bg-paper p-4 dark:border-night-line dark:bg-night sm:flex-row sm:items-center sm:justify-between">
      {BADGES.map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-2 text-xs text-ink-soft dark:text-paper/60">
          <Icon className="h-4 w-4 shrink-0 text-route" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}