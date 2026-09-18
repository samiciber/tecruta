import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm dark:bg-black/60"
        onClick={onClose}
      />
      <div className="card-surface relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-xl2 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink dark:text-paper">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-ink-soft hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
