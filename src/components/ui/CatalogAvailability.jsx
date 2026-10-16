import React from 'react'
import { useLocation } from 'react-router-dom'
import { useProductIndex } from '../../hooks/useProductIndex.js'
import { useCart } from '../../hooks/useCart.js'

const box = 'rounded-xl border border-amber-500/50 bg-amber-50 p-4 text-sm text-ink dark:bg-night-surface dark:text-paper'
export function CatalogAvailability() {
  const { pathname } = useLocation()
  const { error, isFallback, refresh, refreshing } = useProductIndex({ enabled: pathname !== '/' && !pathname.startsWith('/admin') })
  if (pathname.startsWith('/admin') || !error) return null
  return <div className="container-tr pt-4"><div role="status" className={box}>
    <p>{isFallback ? 'Mostramos un catálogo de referencia. Para comprar necesitamos verificar precios y disponibilidad.' : 'No pudimos actualizar el catálogo. Las compras están pausadas hasta verificar precios y disponibilidad.'}</p>
    <button type="button" disabled={refreshing} onClick={() => void refresh().catch(() => {})} className="mt-2 font-semibold underline disabled:opacity-60">{refreshing ? 'Actualizando catálogo…' : 'Reintentar catálogo'}</button>
  </div></div>
}
export function CartReviewNotice() {
  const { reviewItems, removeReviewItems, entries, updateQuantity } = useCart()
  const { ready, loading, index } = useProductIndex()
  if (loading || !entries.length || !reviewItems.length) return null
  return <div role="status" className={box}>
    <p>{ready ? 'Algunos productos ya no están disponibles o tienen menos unidades. Revisa las cantidades antes de comprar.' : 'Tu carrito sigue guardado. Reintenta el catálogo para comprobar todos sus productos.'}</p>
    {ready && reviewItems.map(entry => {
      const product = index.find(p => p.id === entry.productId)
      return product?.stock > 0 ? <button key={entry.productId} type="button" onClick={() => updateQuantity(entry.productId, product.stock)} className="mt-2 block font-semibold underline">Usar {product.stock} unidades de {product.name}</button> : null
    })}
    {ready && <button type="button" onClick={removeReviewItems} className="mt-2 font-semibold underline">Quitar productos que requieren revisión</button>}
  </div>
}
