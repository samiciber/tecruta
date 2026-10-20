import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CircleItem, { CIRCLE_SIZE, ITEM_WIDTH } from './CircleItem.jsx'
import { useCategories } from '../../hooks/useCategories.js'
import { useProductIndex } from '../../hooks/useProductIndex.js'
import { useSiteSettings } from '../../hooks/useSiteContent.js'
import { resolveCircles } from '../../utils/homeCircles.js'

// Estado del scroll horizontal: ¿hay desborde?, ¿se puede ir atrás/adelante?
function useScrollState(ref, dep) {
  const [s, setS] = useState({ overflow: false, prev: false, next: false })
  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setS({ overflow: el.scrollWidth > el.clientWidth + 1, prev: el.scrollLeft > 1, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [ref, update, dep])
  return s
}

const ARROW =
  'absolute top-12 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-ink shadow-md transition-opacity hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header disabled:cursor-default disabled:opacity-30 dark:border-night-line dark:bg-night-surface dark:text-paper dark:hover:bg-night sm:top-14 lg:top-16 [@media(hover:hover)]:flex'

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex gap-4 overflow-hidden sm:gap-6">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`${ITEM_WIDTH} flex shrink-0 animate-pulse flex-col items-center`}>
          <span className={`${CIRCLE_SIZE} rounded-full bg-gray-100 dark:bg-white/10`} />
          <span className="mt-3 h-3 w-4/5 rounded bg-gray-100 dark:bg-white/10" />
        </div>
      ))}
    </div>
  )
}

// «Compra por categoría»: carrusel de círculos. Por defecto se alimenta de las
// categorías visibles del árbol; Admin → Círculos de la Home puede elegir cuáles,
// su orden, etiqueta/imagen propias y círculos personalizados. Se oculta si no
// hay ítems. (El prop `counts` ya no se usa: se cuenta aquí; se conserva para no
// romper a quien lo pase.)
export default function CategoryShowcase({ items: suppliedItems, title: suppliedTitle, loading: suppliedLoading }) {
  const { tree, loading: loadingTree } = useCategories()
  const { settings, loading: loadingSettings } = useSiteSettings()
  const { index, loading: loadingProducts } = useProductIndex({ enabled: suppliedItems === undefined })
  const scroller = useRef(null)

  const cfg = settings.homeCircles
  const needsProducts = cfg?.onlyWithProducts !== false
  const loading = suppliedItems === undefined
    ? loadingTree || loadingSettings || (needsProducts && loadingProducts)
    : Boolean(suppliedLoading)
  const items = useMemo(
    () => suppliedItems ?? resolveCircles({ config: cfg, tree, products: index }),
    [suppliedItems, cfg, tree, index],
  )
  const { overflow, prev, next } = useScrollState(scroller, items.length)

  const scrollBy = (dir) => {
    const el = scroller.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: reduced ? 'auto' : 'smooth' })
  }

  if (!loading && items.length === 0) return null
  const title = suppliedTitle || cfg?.title || 'Compra por categoría'

  return (
    <section id="categorias" aria-labelledby="circles-title" aria-busy={loading || undefined} className="store-category-shelf container-tr py-6 sm:py-10">
      <h2 id="circles-title" className="mb-5 font-display text-2xl font-bold tracking-tight text-ink dark:text-paper sm:text-3xl">{title}</h2>
      {loading ? (
        <Skeleton />
      ) : (
        <div className="relative">
          {overflow && (
            <>
              <button type="button" aria-label="Ver categorías anteriores" onClick={() => scrollBy(-1)} disabled={!prev} className={`${ARROW} -left-3 xl:-left-5`}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Ver más categorías" onClick={() => scrollBy(1)} disabled={!next} className={`${ARROW} -right-3 xl:-right-5`}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}
          <ul
            ref={scroller}
            aria-label={title}
            className="store-category-list scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 sm:gap-6"
          >
            {items.map((c) => (
              <li key={c.key} className="shrink-0">
                <CircleItem label={c.label} to={c.to} image={c.image} external={c.external} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}