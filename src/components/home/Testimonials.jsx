import React from 'react'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { testimonials } from '../../data/testimonials.js'
import { useProductIndex } from '../../hooks/useProductIndex.js'
import { formatCurrency } from '../../utils/formatCurrency.js'

function initialsFor(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

function TestimonialCard({ testimonial, product }) {
  return (
    <div className="flex w-[280px] shrink-0 snap-start flex-col gap-4 rounded-xl2 border border-paper-line bg-paper-surface p-5 dark:border-night-line dark:bg-night-surface sm:w-[320px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5" aria-label={`${testimonial.rating} de 5 estrellas`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < testimonial.rating ? 'fill-signal-amber text-signal-amber' : 'fill-transparent text-paper-line dark:text-night-line'
              }`}
            />
          ))}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-route-soft text-xs font-semibold text-route dark:bg-route-softDark">
          {initialsFor(testimonial.name)}
        </div>
      </div>

      <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-ink-soft dark:text-paper/70">“{testimonial.comment}”</p>

      <p className="text-sm font-semibold text-ink dark:text-paper">{testimonial.name}</p>

      {product && (
        <Link
          to={`/producto/${product.slug}`}
          className="flex items-center gap-3 rounded-lg border border-paper-line p-2.5 transition-colors hover:border-ink/30 dark:border-night-line dark:hover:border-paper/30"
        >
          <img src={product.image} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" loading="lazy" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink dark:text-paper">{product.name}</p>
            <p className="text-xs text-ink-soft/70 dark:text-paper/50">{formatCurrency(product.price)}</p>
          </div>
        </Link>
      )}
    </div>
  )
}

export default function Testimonials() {
  const { index } = useProductIndex()

  if (testimonials.length === 0) return null

  return (
    <section className="border-t border-paper-line bg-paper-surface py-16 dark:border-night-line dark:bg-night-surface sm:py-24">
      <div className="container-tr mb-8 sm:mb-10">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-route">Clientes reales</span>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:text-4xl">
          Directamente de nuestros clientes
        </h2>
      </div>

      <div className="container-tr">
        <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
          {testimonials.map((testimonial) => {
            const product = index.find((p) => p.id === testimonial.productId)
            return <TestimonialCard key={testimonial.id} testimonial={testimonial} product={product} />
          })}
        </div>
      </div>
    </section>
  )
}