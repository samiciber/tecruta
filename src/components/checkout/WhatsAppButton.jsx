import React from 'react'
import { MessageCircle } from 'lucide-react'

export default function WhatsAppButton({ onConfirm, disabled, submitting, retry, className = '' }) {
  return (
    <button type="button" onClick={onConfirm} disabled={disabled || submitting} aria-busy={submitting}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#07723A] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 ${className}`}>
      <MessageCircle className="h-4 w-4" />
      {submitting ? 'Registrando pedido…' : retry ? 'Reintentar' : 'Registrar pedido y continuar'}
    </button>
  )
}
