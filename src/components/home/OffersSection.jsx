import React from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../product/ProductCard.jsx'

// Solo se muestra si existen productos con compareAtPrice real (descuento
// verdadero). Si no hay ninguno, el componente no renderiza nada — queda
// preparado para cuando sí existan ofertas reales, sin inventar precios.
export default function OffersSection({ products }) {
  const conDescuento = (products || []).filter((p) => p.compareAtPrice && p.compareAtPrice > p.price)

  if (conDescuento.length === 0) return null

  return (
    <section className="container-tr py-16 sm:py-24">
      <div className="mb-8 flex items-end justify-between sm:mb-10">
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-signal-red">Tiempo limitado</span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:text-4xl">Ofertas</h2>
        </div>
        <Link to="/catalogo?ordenar=discount" className="hidden text-sm font-medium text-route hover:underline sm:inline">
          Ver todo
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {conDescuento.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
