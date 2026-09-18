import React from 'react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-paper-line px-6 py-16 text-center dark:border-night-line">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-route-soft text-route dark:bg-route-softDark">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-ink dark:text-paper">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-ink-soft dark:text-paper/60">{description}</p>
      )}
      {action}
    </div>
  )
}
