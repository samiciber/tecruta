import React, { createContext, useCallback, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

export const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
}

const TONE_CLASSES = {
  success: 'border-signal-green/30 text-signal-green',
  info: 'border-route/30 text-route',
  error: 'border-signal-red/30 text-signal-red',
}

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  // options: { actionLabel, onAction } agrega un botón de acción (p. ej.
  // «Ir al carrito»); los toasts con acción duran más para poder pulsarla.
  const showToast = useCallback((message, tone = 'info', options = {}) => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, message, tone, actionLabel: options.actionLabel, onAction: options.onAction }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, options.actionLabel ? 6000 : 3200)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] || Info
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-paper-surface px-4 py-3 text-sm font-medium shadow-card animate-toast-in dark:bg-night-surface dark:shadow-card-dark ${TONE_CLASSES[t.tone] || TONE_CLASSES.info}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-ink dark:text-paper">{t.message}</span>
              {t.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction?.()
                    dismissToast(t.id)
                  }}
                  className="shrink-0 rounded-full bg-header px-3 py-1 text-xs font-bold text-white hover:bg-header-band"
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                type="button"
                aria-label="Cerrar notificación"
                onClick={() => dismissToast(t.id)}
                className="shrink-0 text-ink-soft/60 hover:text-ink dark:text-paper/50 dark:hover:text-paper"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}