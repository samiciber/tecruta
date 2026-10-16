import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from '../product/ProductCard.jsx'

function HomeLink({ href, children, className }) {
  return /^https?:\/\//.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link to={href} className={className}>{children}</Link>
}

function useScrollControls(ref, tabId) {
  const [state, setState] = useState({ previous: false, next: false })
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => setState({
      previous: element.scrollLeft > 1,
      next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    })
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [ref, tabId])
  return state
}

export function ProductCarousel({ id, title, tabs, panel, countdown, endsAt, embedded = false }) {
  const [active, setActive] = useState(0)
  const scroller = useRef(null)
  const tabRefs = useRef([])
  const tab = tabs[active] || tabs[0]
  const controls = useScrollControls(scroller, tab?.id)
  const selectTab = index => { setActive(index); if (scroller.current) scroller.current.scrollLeft = 0 }
  const tabKey = event => {
    const targets = { ArrowRight: (active + 1) % tabs.length, ArrowLeft: (active + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }
    if (!(event.key in targets)) return
    event.preventDefault(); selectTab(targets[event.key]); tabRefs.current[targets[event.key]]?.focus()
  }

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, tabs.length - 1)))
  }, [tabs.length])

  if (!tab || tab.products.length === 0) return null

  const scroll = (direction) => {
    const element = scroller.current
    if (!element) return
    element.scrollBy({ left: direction * Math.max(220, element.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <section className={embedded ? 'h-full min-w-0' : 'container-tr py-6 sm:py-10'} aria-labelledby={`home-products-title-${id}`}>
      <div className={`grid h-full gap-5 rounded-2xl border border-paper-line bg-paper-surface p-4 dark:border-night-line dark:bg-night-surface sm:p-6 ${panel ? 'lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.34fr)]' : ''}`}>
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 id={`home-products-title-${id}`} className="break-words font-display text-2xl font-bold tracking-tight text-ink dark:text-paper sm:text-3xl">{title}</h2>
                {countdown && <time dateTime={endsAt} aria-label={`Tiempo restante: ${countdown}`} className="rounded-full bg-route-soft px-3 py-1 font-mono text-sm font-semibold text-route dark:bg-route-softDark dark:text-sky-300">{countdown}</time>}
              </div>
              {tabs.length > 1 && (
                <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label={`Fuentes de ${title}`}>
                  {tabs.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      ref={element => { tabRefs.current[index] = element }}
                      tabIndex={index === active ? 0 : -1}
                      aria-selected={index === active}
                      id={`home-products-tab-${id}-${item.id}`}
                      aria-controls={`home-products-panel-${id}`}
                      onClick={() => selectTab(index)}
                      onKeyDown={tabKey}
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${index === active ? 'border-route bg-route-soft text-route dark:bg-route-softDark dark:text-sky-300' : 'border-paper-line text-ink-soft hover:text-ink dark:border-night-line dark:text-paper/70 dark:hover:text-paper'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tab.href && <HomeLink href={tab.href} className="shrink-0 text-sm font-semibold text-route hover:underline dark:text-sky-300">Ver todo</HomeLink>}
          </div>

          <div className="relative">
            {controls.previous && (
              <button type="button" aria-label="Productos anteriores" onClick={() => scroll(-1)} className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-paper-line bg-paper text-ink shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route dark:border-night-line dark:bg-night dark:text-paper sm:flex">
                <ChevronLeft aria-hidden="true" />
              </button>
            )}
            <div
              id={`home-products-panel-${id}`}
              ref={scroller}
              role={tabs.length > 1 ? 'tabpanel' : 'region'}
              tabIndex={0}
              aria-labelledby={tabs.length > 1 ? `home-products-tab-${id}-${tab.id}` : `home-products-title-${id}`}
              aria-label={tab.label}
              className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
            >
              {tab.products.map((product) => (
                <div key={product.id} className="w-[min(72vw,220px)] shrink-0 snap-start sm:w-[220px]">
                  <ProductCard product={product} verifyOnAdd />
                </div>
              ))}
            </div>
            {controls.next && (
              <button type="button" aria-label="Más productos" onClick={() => scroll(1)} className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-paper-line bg-paper text-ink shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route dark:border-night-line dark:bg-night dark:text-paper sm:flex">
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {panel && (
          <aside className="flex min-h-40 flex-col justify-center break-words rounded-xl2 bg-route-soft p-5 dark:bg-route-softDark">
            <h3 className="font-display text-xl font-bold text-ink dark:text-paper">{panel.title}</h3>
            {panel.description && <p className="mt-2 text-sm text-ink-soft dark:text-paper/70">{panel.description}</p>}
            {panel.href && panel.label && <HomeLink href={panel.href} className="mt-4 w-fit font-semibold text-route underline dark:text-sky-300">{panel.label}</HomeLink>}
          </aside>
        )}
      </div>
    </section>
  )
}
