import React from 'react'
import { Truck, ShieldCheck, Sparkles, MessageCircle } from 'lucide-react'

const ITEMS = [
  { icon: Truck, title: 'Envíos a todo Perú', description: 'Lima y provincias, coordinado por WhatsApp.' },
  { icon: ShieldCheck, title: 'Pago seguro', description: 'Yape, Plin, transferencia o contra entrega.' },
  { icon: Sparkles, title: 'Productos seleccionados', description: 'Tecnología UGREEN elegida con criterio.' },
  { icon: MessageCircle, title: 'Atención personalizada', description: 'Te acompañamos antes y después de tu compra.' },
]

export default function TrustSection() {
  return (
    <section className="container-tr py-16 sm:py-24">
      <h2 className="mb-10 text-center font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:mb-12 sm:text-4xl">
        Compra con confianza
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-route-soft text-route dark:bg-route-softDark">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="font-display text-sm font-semibold text-ink dark:text-paper">{title}</h3>
            <p className="text-xs text-ink-soft dark:text-paper/60">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
