import React from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import QuantitySelector from '../product/QuantitySelector.jsx'
import { formatCurrency } from '../../utils/formatCurrency.js'
import { useCart } from '../../hooks/useCart.js'

export default function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCart()

  return (
    <div className="flex gap-3 py-4">
      <Link to={`/producto/${item.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-route-soft dark:bg-route-softDark">
        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <Link to={`/producto/${item.slug}`} className="line-clamp-2 text-sm font-medium text-ink hover:text-route dark:text-paper">
          {item.name}
        </Link>
        <span className="font-mono text-sm text-ink-soft dark:text-paper/60">{formatCurrency(item.price)}</span>
        <div className="mt-auto flex items-center justify-between gap-2">
          <QuantitySelector quantity={item.quantity} max={item.stock} size="sm" onChange={(q) => updateQuantity(item.id, q)} />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            aria-label={`Eliminar ${item.name} del carrito`}
            className="rounded-full p-1.5 text-ink-soft/60 hover:bg-signal-red/10 hover:text-signal-red dark:text-paper/40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <span className="font-mono text-sm font-semibold text-ink dark:text-paper">
        {formatCurrency(item.price * item.quantity)}
      </span>
    </div>
  )
}
