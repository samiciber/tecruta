import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import HeroSlide from './HeroSlide.jsx'
import { storeConfig } from '../../config/storeConfig.js'
import { useCategories } from '../../hooks/useCategories.js'
import { useSiteSettings } from '../../hooks/useSiteContent.js'

// Altura estable (sin saltos al cargar): fija en móvil/tablet y proporcional
// 1920×600 en escritorio. El esqueleto de carga usa exactamente la misma caja.
const BOX = 'relative w-full h-[420px] sm:h-[380px] md:h-[400px] lg:h-auto lg:aspect-[1920/600] lg:min-h-[320px] lg:max-h-[600px]'
const SWIPE_PX = 50

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

const isLive = (b, now) => b.active !== false && !(b.startsAt && new Date(b.startsAt) > now) && !(b.endsAt && new Date(b.endsAt) <= now)

// Respaldo cuando no hay slides activos: categorías visibles con imagen y, si
// tampoco hay, un slide genérico de marca.
function fallbackSlides(categories) {
  const fromCategories = categories
    .filter((c) => c.image)
    .map((c) => ({
      id: c.slug,
      eyebrow: 'Categoría',
      title: c.name,
      description: c.description || '',
      buttons: [{ label: `Ver ${c.name}`, href: `/categoria/${c.slug}`, style: 'primary' }],
      imageDesktop: c.image,
      position: 'middle-center',
      textAlign: 'center',
      textColor: 'light',
      overlay: 45,
    }))
  if (fromCategories.length > 0) return fromCategories
  return [
    {
      id: 'default',
      eyebrow: storeConfig.name,
      title: storeConfig.tagline,
      description: storeConfig.description,
      buttons: [{ label: 'Ver catálogo', href: '/catalogo', style: 'primary' }],
      position: 'middle-center',
      textAlign: 'center',
      textColor: 'light',
      overlay: 0,
    },
  ]
}

export default function HeroSlider({ slides: suppliedSlides, carouselConfig, loading: suppliedLoading }) {
  const { settings, loading } = useSiteSettings()
  const { categories } = useCategories()
  const reduced = usePrefersReducedMotion()
  const [active, setActive] = useState(0)
  // Tres motivos de pausa independientes (uno no "pisa" a otro): mouse encima,
  // foco por teclado dentro del carrusel y el botón visible de pausa/reproducir.
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  // Los cambios automáticos NO se anuncian; solo los manuales (aria-live polite).
  const [announce, setAnnounce] = useState(false)
  const swipe = useRef(null)
  const regionRef = useRef(null)

  const cfg = carouselConfig || settings.heroCarousel || { intervalSeconds: 6, autoplay: true }

  const slides = useMemo(() => {
    if (Array.isArray(suppliedSlides)) return suppliedSlides
    const now = new Date()
    const live = (settings.homeBanners || []).filter((b) => (b.placement ?? 'hero') === 'hero' && isLive(b, now))
    return live.length > 0 ? live : fallbackSlides(categories)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliedSlides, settings.homeBanners, categories])

  const count = slides.length
  const multi = count > 1
  const autoplayOn = multi && cfg.autoplay !== false && !reduced
  const paused = hoverPaused || focusPaused || userPaused

  // Si cambia la cantidad de slides (revalidación), el índice no se pasa de rango.
  useEffect(() => {
    if (active >= count) setActive(0)
  }, [count, active])

  const goTo = useCallback((i, manual) => {
    setAnnounce(Boolean(manual))
    setActive(((i % count) + count) % count)
  }, [count])

  // Rotación automática: un temporizador que se reinicia en cada cambio.
  useEffect(() => {
    if (!autoplayOn || paused) return undefined
    const id = window.setTimeout(() => goTo(active + 1, false), Math.max(3, cfg.intervalSeconds) * 1000)
    return () => window.clearTimeout(id)
  }, [autoplayOn, paused, active, cfg.intervalSeconds, goTo])

  const onKeyDown = (e) => {
    if (!multi) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1, true) }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1, true) }
  }
  // Foco por teclado (no por clic) pausa la rotación; salir del carrusel la reanuda.
  const onFocus = (e) => {
    if (e.target.matches?.(':focus-visible')) setFocusPaused(true)
  }
  const onBlur = (e) => {
    if (!regionRef.current?.contains(e.relatedTarget)) setFocusPaused(false)
  }
  // Deslizar con el dedo (touch-action: pan-y deja pasar el scroll vertical).
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e) => {
    const s = swipe.current
    swipe.current = null
    if (!s || !multi) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) goTo(active + (dx < 0 ? 1 : -1), true)
  }

  // Cargando: misma caja que el hero final (sin salto de diseño ni parpadeo).
  if (suppliedLoading || (suppliedSlides === undefined && loading)) {
    return <section id="home-hero" aria-busy="true" aria-label="Destacados" className={`${BOX} animate-pulse bg-gradient-to-br from-header to-route-dark`} />
  }

  return (
    <section
      id="home-hero"
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Destacados"
      tabIndex={multi ? 0 : undefined}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`${BOX} bg-night focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white`}
    >
      <div
        aria-live={announce ? 'polite' : 'off'}
        aria-atomic="false"
        className="h-full w-full touch-pan-y overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null }}
      >
        <div className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${active * 100}%)` }}>
          {slides.map((slide, i) => {
            const current = i === active
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} de ${count}`}
                aria-hidden={current ? undefined : true}
                {...(current ? {} : { inert: '' })}
                className="h-full w-full shrink-0 basis-full"
              >
                <HeroSlide slide={slide} priority={i === 0} controls={multi} mobileFocus />
              </div>
            )
          })}
        </div>
      </div>

      {multi && (
        <>
          <button type="button" onClick={() => goTo(active - 1, true)} aria-label="Diapositiva anterior" className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header md:flex">
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => goTo(active + 1, true)} aria-label="Diapositiva siguiente" className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header md:flex">
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
            {autoplayOn && (
              <button
                type="button"
                onClick={() => setUserPaused((v) => !v)}
                aria-label={userPaused ? 'Reanudar la rotación automática' : 'Pausar la rotación automática'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header"
              >
                {userPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            <div className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(i, true)}
                  aria-label={`Ir a la diapositiva ${i + 1} de ${count}`}
                  aria-current={i === active ? 'true' : undefined}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 ${i === active ? 'w-6 bg-white' : 'w-2.5 bg-white/60 hover:bg-white/90'}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}