import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency.js'

// Componente reutilizable: recibe un producto real (del índice o de
// products.js) y arma un banner promocional a partir de sus datos reales.
// No contiene ningún dato de producto hardcodeado.
export default function PromoBanner({ eyebrow, title, description, ctaLabel = 'Ver producto', product }) {
  if (!product) return null

  return (
    <section className="container-tr py-16 sm:py-24">
      <div className="grid grid-cols-1 items-center gap-8 overflow-hidden rounded-xl2 border border-paper-line bg-paper-surface p-8 dark:border-night-line dark:bg-night-surface sm:p-14 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col items-start gap-4">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 rounded-full bg-route-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-route dark:bg-route-softDark">
              {eyebrow}
            </span>
          )}
          <h2 className="max-w-md font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink dark:text-paper sm:text-4xl">
            {title}
          </h2>
          {description && <p className="max-w-sm text-sm text-ink-soft dark:text-paper/60">{description}</p>}
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-ink dark:text-paper">{formatCurrency(product.price)}</span>
            <Link to={`/producto/${product.slug}`} className="btn-primary">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <Link
          to={`/producto/${product.slug}`}
          className="group flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl2 bg-route-soft dark:bg-route-softDark"
        >
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
      </div>
    </section>
  )
}
