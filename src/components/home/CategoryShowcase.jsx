import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Smartphone, Tablet, Laptop } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories.js'

const ICONS = { Cpu, Smartphone, Tablet, Laptop }

export default function CategoryShowcase({ counts = {} }) {
  // Solo categorías visibles del árbol que ya tienen productos (o imagen).
  // Si todavía no hay ninguna, la sección no se muestra (sin tarjetas vacías).
  const { categories: all } = useCategories()
  const categories = all.filter((c) => (counts[c.slug] ?? 0) > 0)
  if (categories.length === 0) return null
  return (
    <section id="categorias" className="container-tr py-16 sm:py-24">
      <div className="mb-8 flex flex-col gap-1.5 text-center sm:mb-10 sm:text-left">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-route">Catálogo</span>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:text-4xl">Compra por categoría</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {categories.map((c) => {
          const Icon = ICONS[c.icon] || Cpu
          const count = counts[c.slug] ?? 0
          const comingSoon = count === 0
          const image = c.image

          return (
            <Link
              key={c.slug}
              to={`/categoria/${c.slug}`}
              className="group relative block h-[260px] w-full overflow-hidden sm:h-[300px] lg:h-[360px]"
            >
              {/* Fondo: foto real o degradado de marca + ícono */}
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-header to-route-dark transition-transform duration-500 ease-out group-hover:scale-105`}
                >
                  <Icon className="h-28 w-28 text-white/15 sm:h-36 sm:w-36" strokeWidth={1} />
                </div>
              )}

              {/* Velo oscuro para legibilidad del texto */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />

              {/* Texto superpuesto */}
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7 lg:p-8">
                <h3 className="font-display text-xl font-bold text-white sm:text-2xl">{c.name}</h3>
                <p className="mt-1.5 max-w-xs text-sm text-white/75 line-clamp-2">{c.description}</p>
                <span
                  className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${
                    comingSoon
                      ? 'border-white/20 bg-white/10 text-white/70'
                      : 'border-signal-green/30 bg-signal-green/15 text-signal-green'
                  }`}
                >
                  {comingSoon ? 'Próximamente' : `${count} producto${count === 1 ? '' : 's'}`}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}