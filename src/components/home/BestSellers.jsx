import React from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../product/ProductCard.jsx'

export default function BestSellers({ products }) {
  if (!products || products.length === 0) return null

  return (
    <section className="container-tr py-16 sm:py-24">
      <div className="mb-8 flex items-end justify-between sm:mb-10">
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-route">Lo que más se lleva</span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:text-4xl">Más vendidos</h2>
        </div>
        <Link to="/catalogo" className="hidden text-sm font-medium text-route hover:underline sm:inline">
          Ver todo
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
