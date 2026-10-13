import React from 'react'
import { MessageCircle } from 'lucide-react'
import { buildWhatsAppOrderLink } from '../../utils/whatsapp.js'

export default function WhatsAppButton({ items, paymentMethodDetails, customer, delivery, onBeforeSend, disabled, className = '' }) {
  const href = buildWhatsAppOrderLink(items, { paymentMethodDetails, customer, delivery })

  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    // Efecto en paralelo (no bloqueante): NO se llama con await ni se
    // frena la navegación por él. Si falla, WhatsApp se abre igual.
    if (onBeforeSend?.() === false) e.preventDefault()
  }

  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      onClick={handleClick}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-signal-green px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] ${
        disabled ? 'pointer-events-none opacity-40' : ''
      } ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      Comprar por WhatsApp
    </a>
  )
}
