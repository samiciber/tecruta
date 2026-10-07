import React from 'react'
import { MessageCircle } from 'lucide-react'
import { storeConfig } from '../../config/storeConfig.js'

// Burbuja flotante de soporte por WhatsApp (abajo a la derecha).
export default function WhatsAppBubble({ message = 'Hola, necesito ayuda con mi compra en TecRuta.' }) {
  const href = `https://wa.me/${storeConfig.whatsapp.number}?text=${encodeURIComponent(message)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl ring-4 ring-white/80 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-header dark:ring-night/80 sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-7 w-7" aria-hidden="true" />
    </a>
  )
}