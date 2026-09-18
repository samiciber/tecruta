import FreeShippingBar from './FreeShippingBar.jsx'
import CartUpsell from './CartUpsell.jsx'
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, X } from 'lucide-react'
import CartItem from './CartItem.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import { formatCurrency } from '../../utils/formatCurrency.js'
import { useCart } from '../../hooks/useCart.js'

export default function CartDrawer() {
  const { items, subtotal, isOpen, setIsOpen } = useCart()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && setIsOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Carrito de compras">
      <button aria-label="Cerrar carrito" className="absolute inset-0 bg-ink/40 backdrop-blur-sm dark:bg-black/60" onClick={() => setIsOpen(false)} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in-right flex-col bg-paper-surface shadow-2xl dark:bg-night-surface">
        <div className="flex items-center justify-between border-b border-paper-line px-5 py-4 dark:border-night-line">
          <h2 className="font-display text-lg font-semibold text-ink dark:text-paper">Tu carrito</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar carrito"
            className="rounded-full p-1.5 text-ink-soft hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Tu carrito está vacío"
              description="Explora el catálogo y agrega los productos que necesites."
              action={
                <Link to="/catalogo" onClick={() => setIsOpen(false)} className="btn-secondary mt-2">
                  Ver catálogo
                </Link>
              }
            />
                    ) : (
            <div>
              <div className="pt-4">
                <FreeShippingBar subtotal={subtotal} />
              </div>
              <div className="divide-y divide-paper-line dark:divide-night-line">
                {items.map((item) => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
              <CartUpsell />
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-paper-line px-5 py-4 dark:border-night-line">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-ink-soft dark:text-paper/60">Subtotal</span>
              <span className="font-mono text-base font-semibold text-ink dark:text-paper">{formatCurrency(subtotal)}</span>
            </div>
            <Link to="/checkout" onClick={() => setIsOpen(false)} className="btn-primary w-full">
              Ir al checkout
            </Link>
            <button type="button" onClick={() => setIsOpen(false)} className="btn-ghost mt-2 w-full">
              Seguir comprando
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
