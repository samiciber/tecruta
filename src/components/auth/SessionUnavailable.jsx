import React from 'react'

export default function SessionUnavailable({ onRetry }) {
  return (
    <div className="container-tr mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-4 py-12 text-center">
      <h1 className="font-display text-xl font-bold text-ink dark:text-paper">No pudimos comprobar tu sesión</h1>
      <p role="alert" className="text-sm text-ink-soft dark:text-paper/60">Tu sesión guardada se conserva. Vuelve a intentarlo cuando la conexión esté disponible.</p>
      <button type="button" onClick={onRetry} className="btn-primary">Reintentar sesión</button>
    </div>
  )
}
