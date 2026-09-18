import React from 'react'
import { Minus, Plus } from 'lucide-react'

export default function QuantitySelector({ quantity, max = 99, onChange, size = 'md' }) {
  const dec = () => onChange(Math.max(1, quantity - 1))
  const inc = () => onChange(Math.min(max, quantity + 1))
  const isSmall = size === 'sm'

  return (
    <div className={`inline-flex items-center rounded-full border border-paper-line dark:border-night-line ${isSmall ? 'h-8' : 'h-11'}`}>
      <button
        type="button"
        onClick={dec}
        disabled={quantity <= 1}
        aria-label="Disminuir cantidad"
        className="flex h-full w-8 items-center justify-center text-ink-soft transition-colors hover:text-ink disabled:opacity-30 dark:text-paper/60 dark:hover:text-paper"
      >
        <Minus className={isSmall ? 'h-3 w-3' : 'h-4 w-4'} />
      </button>
      <span className={`min-w-[1.75rem] text-center font-mono font-medium text-ink dark:text-paper ${isSmall ? 'text-xs' : 'text-sm'}`}>
        {quantity}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={quantity >= max}
        aria-label="Aumentar cantidad"
        className="flex h-full w-8 items-center justify-center text-ink-soft transition-colors hover:text-ink disabled:opacity-30 dark:text-paper/60 dark:hover:text-paper"
      >
        <Plus className={isSmall ? 'h-3 w-3' : 'h-4 w-4'} />
      </button>
    </div>
  )
}
