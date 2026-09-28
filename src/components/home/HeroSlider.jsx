import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, PlugZap, Cable, Headphones, Cpu, Smartphone, Tablet, Laptop, BatteryCharging } from 'lucide-react'
import { heroSlides } from '../../data/heroSlides.js'
import { useCategories } from '../../hooks/useCategories.js'

const AUTOPLAY_MS = 6000

const ICONS = { PlugZap, Cable, Headphones, Cpu, Smartphone, Tablet, Laptop, BatteryCharging }

// Degradado de respaldo cuando un slide no trae 'media' (imagen/video) todavía.
// Usa la misma paleta de marca que el resto del sitio, por categoría.
const FALLBACK_GRADIENTS = {
  'power-banks': 'from-route to-route-dark',
  cargadores: 'from-signal-amber to-[#F0B96B]',
  cables: 'from-[#7C3AED] to-[#C4B0FA]',
  audifonos: 'from-signal-green to-[#7BD9A5]',
  accesorios: 'from-[#7C3AED] to-[#C4B0FA]',
  celulares: 'from-[#0EA5B7] to-[#8FE1EA]',
  tablets: 'from-signal-green to-[#7BD9A5]',
  laptops: 'from-signal-amber to-[#F0B96B]',
}

export default function HeroSlider() {
  const [active, setActive] = useState(0)
  // Tres motivos independientes de pausa (así uno no "pisa" a otro):
  // hover sobre flechas/puntos, foco por TECLADO en ellos, y el botón
  // visible de pausa/reproducir del usuario.
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const paused = hoverPaused || focusPaused || userPaused
  const timerRef = useRef(null)
  const { categories } = useCategories()

  // Enriquecemos cada slide con los datos reales de su categoría (nombre,
  // slug) — el destino del enlace siempre se resuelve contra la lista de
  // categorías actual (API con respaldo estático, vía useCategories).
  const slides = useMemo(
    () =>
      heroSlides
        .map((slide) => {
          const categoryData = categories.find((c) => c.slug === slide.category)
          return categoryData ? { ...slide, categoryData } : null
        })
        .filter(Boolean),
    [categories],
  )

  // Nota: antes aquí se desactivaba el autoplay por completo si el sistema
  // reportaba prefers-reduced-motion (en Windows basta con tener apagados
  // los "Efectos de animación"), lo que en escritorio lo dejaba inerte. Ya
  // no hace falta: bajo esa preferencia index.css fuerza transition-duration
  // ~0, así que el cambio de slide es un corte instantáneo (sin movimiento),
  // y el usuario siempre puede detener el carrusel con el botón de pausa.
  useEffect(() => {
    if (paused || slides.length <= 1) return
    timerRef.current = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timerRef.current)
  }, [paused, slides.length])

  if (slides.length === 0) return null

  const goTo = (i) => setActive(((i % slides.length) + slides.length) % slides.length)

  // Solo el foco por teclado pausa: tras un clic con el mouse el botón
  // conserva el foco, pero ':focus-visible' es falso, así que no se queda
  // "pegado" en pausa.
  const handleFocus = (e) => {
    if (e.target.matches?.(':focus-visible')) setFocusPaused(true)
  }
  const pauseHandlers = {
    onMouseEnter: () => setHoverPaused(true),
    onMouseLeave: () => setHoverPaused(false),
    onFocus: handleFocus,
    onBlur: () => setFocusPaused(false),
  }

  return (
    <section
      id="home-hero"
      className="relative w-full overflow-hidden border-b border-paper-line bg-ink dark:border-night-line"
      aria-roledescription="carrusel"
      aria-label="Categorías destacadas"
    >
      <div className="relative h-[520px] w-full sm:h-[600px] lg:h-[700px] xl:h-[760px]">
        {slides.map((slide, i) => {
          const Icon = ICONS[slide.categoryData.icon] || Cpu
          const isActive = i === active
          const href = `/catalogo?categoria=${slide.category}`

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isActive ? 'z-10 opacity-100' : 'z-0 opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              {/* Fondo: imagen, video, o degradado de respaldo */}
              <div className="absolute inset-0">
                {slide.media?.type === 'video' ? (
                  <video
                    className="h-full w-full object-cover"
                    src={slide.media.src}
                    poster={slide.media.poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : slide.media?.type === 'image' ? (
                  <img
                    src={slide.media.src}
                    alt=""
                    className="h-full w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${FALLBACK_GRADIENTS[slide.category] || 'from-route to-route-dark'}`}>
                    <Icon className="h-40 w-40 text-white/15 sm:h-56 sm:w-56" strokeWidth={1} />
                  </div>
                )}
                {/* Velo oscuro para legibilidad del texto: si el texto va arriba,
                    el degradado oscurece la parte de arriba en vez de abajo/costado */}
                <div
                  className={
                    slide.textPosition === 'top'
                      ? 'absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/25 to-ink/10'
                      : 'absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-ink/10 sm:bg-gradient-to-r sm:from-ink/80 sm:via-ink/35 sm:to-transparent'
                  }
                />
              </div>

              {/* Contenido superpuesto */}
              <Link
                to={href}
                className={`group relative flex h-full w-full ${
                  slide.textPosition === 'top' ? 'items-start' : 'items-end sm:items-center'
                }`}
                aria-label={`Ver ${slide.categoryData.name}`}
                tabIndex={isActive ? 0 : -1}
              >
                <div className={`container-tr ${slide.textPosition === 'top' ? 'pt-8 sm:pt-12 lg:pt-14' : 'pb-10 sm:pb-0'}`}>
                  <div className="flex max-w-xl flex-col items-start gap-5 text-white">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      {slide.eyebrow}
                    </span>
                    <h2 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                      {slide.title}
                    </h2>
                    <p className="max-w-md text-base text-white/80 sm:text-lg">{slide.subtitle}</p>
                    <span className="btn-primary mt-2 px-6 py-3 text-sm transition-transform group-hover:translate-x-0.5">
                      {slide.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            {...pauseHandlers}
            aria-label="Categoría anterior"
            className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            {...pauseHandlers}
            aria-label="Siguiente categoría"
            className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2"
            role="tablist"
            aria-label="Seleccionar categoría"
            {...pauseHandlers}
          >
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Ir a ${slide.categoryData.name}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setUserPaused((v) => !v)}
            aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
            className="absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
    </section>
  )
}