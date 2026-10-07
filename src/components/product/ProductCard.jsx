import React from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { formatCurrency, calculateDiscountPercent } from '../../utils/formatCurrency.js'
import { useCart } from '../../hooks/useCart.js'
import SaveButton from './SaveButton.jsx'

function ProductCard({ product }) {
  const { addItem } = useCart()
  const discount = calculateDiscountPercent(product.price, product.compareAtPrice)
  const outOfStock = product.stock <= 0
  const lowStock = !outOfStock && product.stock <= 5

  return (
    <div className="group relative flex flex-col">
      <SaveButton product={product} />
      <Link
        to={`/producto/${product.slug}`}
        className="relative block aspect-square overflow-hidden rounded-xl2 bg-paper-surface transition-shadow duration-300 group-hover:shadow-card dark:bg-night-surface"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-signal-red px-2.5 py-1 text-xs font-semibold text-white">
            -{discount}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-semibold text-white backdrop-blur-[1px] dark:bg-black/50">
            Sin stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft/60 dark:text-paper/40">{product.brand}</span>

        <Link
          to={`/producto/${product.slug}`}
          className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink transition-colors hover:text-route dark:text-paper"
        >
          {product.name}
        </Link>

        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-lg font-bold text-ink dark:text-paper">{formatCurrency(product.price)}</span>
          {product.compareAtPrice && (
            <span className="font-mono text-xs text-ink-soft/60 line-through dark:text-paper/40">
              {formatCurrency(product.compareAtPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${outOfStock ? 'bg-signal-red' : lowStock ? 'bg-signal-amber' : 'bg-signal-green'}`} />
          <span className={outOfStock ? 'text-signal-red' : lowStock ? 'text-signal-amber' : 'text-ink-soft/70 dark:text-paper/50'}>
            {outOfStock ? 'Agotado' : lowStock ? 'Pocas unidades' : 'Disponible'}
          </span>
        </div>

        <button
          type="button"
          disabled={outOfStock}
          onClick={() => addItem(product, 1)}
          className="btn-secondary mt-2.5 w-full py-2 text-xs transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          {outOfStock ? 'Sin stock' : 'Agregar al carrito'}
        </button>
      </div>
    </div>
  )
}

export default React.memo(ProductCard)