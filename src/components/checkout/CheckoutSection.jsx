import React from 'react'
import { Pencil, Check } from 'lucide-react'

export default function CheckoutSection({ step, title, status, summary, onEdit, children }) {
  const isActive = status === 'active'
  const isDone = status === 'done'

  return (
    <section
      className={`rounded-xl2 border p-5 transition-colors sm:p-6 ${
        isActive
          ? 'border-route/40 bg-paper-surface dark:bg-night-surface'
          : 'border-paper-line bg-paper-surface/60 dark:border-night-line dark:bg-night-surface/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          className={`flex items-center gap-2.5 font-display text-base font-bold sm:text-lg ${
            isActive || isDone ? 'text-ink dark:text-paper' : 'text-ink-soft/50 dark:text-paper/30'
          }`}
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isDone
                ? 'bg-signal-green text-white'
                : isActive
                  ? 'bg-route text-white'
                  : 'bg-paper-line text-ink-soft/60 dark:bg-night-line dark:text-paper/40'
            }`}
          >
            {isDone ? <Check className="h-3.5 w-3.5" /> : step}
          </span>
          {title}
        </h2>
        {isDone && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-route hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
      </div>

      {isDone && summary && <div className="mt-3 flex flex-col gap-1 pl-8">{summary}</div>}
      {isActive && <div className="mt-4 sm:pl-8">{children}</div>}
    </section>
  )
}