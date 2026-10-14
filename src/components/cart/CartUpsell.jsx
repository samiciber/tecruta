import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useProductIndex } from '../../hooks/useProductIndex.js'
import { formatCurrency } from '../../utils/formatCurrency.js'
import { useCart } from '../../hooks/useCart.js'

export default function CartUpsell() {
  const { index } = useProductIndex()
  const { items, addItem, canAdd } = useCart()

  const suggestions = useMemo(() => {
    if (items.length === 0 || index.length === 0) return []
    const cartIds = new Set(items.map((i) => i.id))
    const cartCategories = new Set(items.map((i) => i.category))
    return index
      .filter((p) => cartCategories.has(p.category) && !cartIds.has(p.id) && p.stock > 0)
      .sort((a, b) => Number(b.featured) - Number(a.featured))
      .slice(0, 3)
  }, [items, index])

  if (suggestions.length === 0) return null

  return (
    <div className="mt-2 border-t border-paper-line pt-4 dark:border-night-line">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">
        Complementa tu compra
      </h3>
      <div className="flex flex-col gap-3">
        {suggestions.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Link to={`/producto/${p.slug}`} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-route-soft dark:bg-route-softDark">
              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/producto/${p.slug}`} className="line-clamp-1 text-xs font-medium text-ink hover:text-route dark:text-paper">
                {p.name}
              </Link>
              <span className="font-mono text-xs text-ink-soft dark:text-paper/60">{formatCurrency(p.price)}</span>
            </div>
            <button
              type="button"
              disabled={!canAdd(p)}
              onClick={() => addItem(p, 1)}
              aria-label={`Agregar ${p.name} al carrito`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-paper-line text-ink-soft transition-colors hover:border-route hover:text-route dark:border-night-line dark:text-paper/60"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
