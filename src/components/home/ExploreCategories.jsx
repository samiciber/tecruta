import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Cpu } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories.js'

// Solo categorías visibles del árbol con productos; `counts` lo arma la Home.
export default function ExploreCategories({ counts = {} }) {
  const { categories } = useCategories()
  const activas = categories.filter((c) => (counts[c.slug] ?? 0) > 0).slice(0, 8)
  if (activas.length === 0) return null

  return (
    <section className="border-t border-paper-line bg-paper-surface py-16 dark:border-night-line dark:bg-night-surface sm:py-24">
      <div className="container-tr">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-route">Navegación rápida</span>
        <h2 className="mb-8 font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:mb-10 sm:text-4xl">Explora TecRuta</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {activas.map((c) => {
            const Icon = Cpu
            return (
              <Link
                key={c.slug}
                to={`/categoria/${c.slug}`}
                className="group flex items-center justify-between gap-3 rounded-xl2 border border-paper-line bg-paper p-5 transition-colors hover:border-route dark:border-night-line dark:bg-night"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-route-soft text-route dark:bg-route-softDark">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-sm font-semibold text-ink dark:text-paper">
                    Ver {c.name.toLowerCase()}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-ink-soft/50 transition-transform group-hover:translate-x-1 dark:text-paper/40" />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}