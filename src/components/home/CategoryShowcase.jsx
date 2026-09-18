import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, Smartphone, Tablet, Laptop } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories.js'

const ICONS = { Cpu, Smartphone, Tablet, Laptop }

// Foto real por categoría (misma fuente que el carrusel principal, para
// mantener consistencia visual). El degradado + ícono queda como respaldo
// por si alguna imagen falla o se agrega una categoría nueva sin foto.
const CATEGORY_IMAGES = {
  'power-banks': 'https://res.cloudinary.com/u6oy2szr/image/upload/w_1200,q_auto,f_auto/0-513aAGv_GmL._AC_SL1500_-removebg-preview',
  cargadores: 'https://res.cloudinary.com/u6oy2szr/image/upload/w_1200,q_auto,f_auto/nexode-car-charger-60w-with-retractable-usb-c-cable-5360591',
  cables: 'https://res.cloudinary.com/u6oy2szr/image/upload/w_1200,q_auto,f_auto/0-UGREENUSBCto3.5mmHeadphoneJackAdapter-NCPGroup',
  audifonos: 'https://res.cloudinary.com/u6oy2szr/image/upload/w_1200,q_auto,f_auto/0-45110',
  accesorios: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787659271/9a98511d-deb4-465b-b225-f0bc220ca79c.png',
  celulares: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787700529/hero_iphone_family__be5jkzxszb1e_large.jpg',
  tablets: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787702079/TabA11-Plus-KV-PCD_KV_DT_1440x640.webp',
  laptops: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787702080/fwebp.png',
}

const FALLBACK_GRADIENTS = {
  accesorios: 'from-[#7C3AED] to-[#C4B0FA]',
  celulares: 'from-[#0EA5B7] to-[#8FE1EA]',
  tablets: 'from-signal-green to-[#7BD9A5]',
  laptops: 'from-signal-amber to-[#F0B96B]',
}

export default function CategoryShowcase({ counts = {} }) {
  const { categories } = useCategories()
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
          const image = CATEGORY_IMAGES[c.slug]

          return (
            <Link
              key={c.slug}
              to={`/catalogo?categoria=${c.slug}`}
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
                  className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${FALLBACK_GRADIENTS[c.slug] || 'from-route to-route-dark'} transition-transform duration-500 ease-out group-hover:scale-105`}
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