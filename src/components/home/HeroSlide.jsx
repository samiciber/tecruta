import React from 'react'
import { Link } from 'react-router-dom'
import { imageSrcSet, optimizeImage } from '../../utils/imageUrl.js'

// Posición del bloque de texto en la grilla 3×3.
export const POSITION_CLASSES = {
  'top-left': 'items-start justify-start',
  'top-center': 'items-start justify-center',
  'top-right': 'items-start justify-end',
  'middle-left': 'items-center justify-start',
  'middle-center': 'items-center justify-center',
  'middle-right': 'items-center justify-end',
  'bottom-left': 'items-end justify-start',
  'bottom-center': 'items-end justify-center',
  'bottom-right': 'items-end justify-end',
}
const ALIGN_CLASSES = { left: 'text-left', center: 'text-center', right: 'text-right', justify: 'text-justify' }
const BUTTONS_JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end', justify: 'justify-start' }

// Tamaños: 'auto' = responsive (Home real); 'desktop' / 'mobile' = fijos (vista
// previa del admin, donde el ancho del contenedor no es el de la pantalla).
const SIZES = {
  auto: {
    pad: 'p-5 sm:p-8 lg:p-12',
    padControls: 'pb-14 sm:pb-14 lg:pb-14',
    title: 'text-2xl sm:text-4xl lg:text-5xl',
    desc: 'text-sm sm:text-base lg:text-lg',
    box: 'max-w-[90%] sm:max-w-xl lg:max-w-2xl',
  },
  desktop: { pad: 'p-12', padControls: 'pb-14', title: 'text-5xl', desc: 'text-lg', box: 'max-w-2xl' },
  mobile: { pad: 'p-5', padControls: 'pb-14', title: 'text-2xl', desc: 'text-sm', box: 'max-w-[90%]' },
  banner: {
    pad: 'p-5 sm:p-6 lg:p-8',
    padControls: '',
    title: 'text-2xl sm:text-3xl',
    desc: 'text-sm sm:text-base',
    box: 'max-w-[90%] sm:max-w-xl',
  },
}

const BTN_BASE =
  'inline-flex items-center rounded-md px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
const BTN_STYLES = {
  light: {
    primary: 'bg-white text-ink hover:bg-gray-100 focus-visible:ring-white focus-visible:ring-offset-black/40',
    secondary: 'border-2 border-white text-white hover:bg-white/15 focus-visible:ring-white focus-visible:ring-offset-black/40',
  },
  dark: {
    primary: 'bg-ink text-white hover:bg-ink/90 focus-visible:ring-ink focus-visible:ring-offset-white',
    secondary: 'border-2 border-ink text-ink hover:bg-ink/10 focus-visible:ring-ink focus-visible:ring-offset-white',
  },
}

const isExternal = (h) => /^https?:\/\//.test(h || '')

// Un slide del hero (y de los banners intercalados): imagen de fondo
// (escritorio / móvil), capa de oscurecimiento y bloque de texto posicionable.
//   priority: primera imagen con prioridad de carga; el resto, perezosas.
//   preview:  vista previa del admin (botones no navegan, sin interacción).
//   controls: reserva espacio abajo para los puntos y el botón de pausa.
export default function HeroSlide({ slide, priority = false, preview = false, controls = false, size = 'auto', mobileFocus = false, className = '' }) {
  const sz = SIZES[size] ?? SIZES.auto
  const isInlineBanner = size === 'banner'
  const color = slide.textColor === 'dark' ? 'dark' : 'light'
  const position = POSITION_CLASSES[slide.position] ?? POSITION_CLASSES['bottom-left']
  const align = ALIGN_CLASSES[slide.textAlign] ?? ALIGN_CLASSES.left
  const mobileImageShade = color === 'dark'
    ? {
        left: 'bg-gradient-to-r from-white/80 via-white/45 to-transparent',
        center: 'bg-white/30',
        right: 'bg-gradient-to-l from-white/80 via-white/45 to-transparent',
      }
    : {
        left: 'bg-gradient-to-r from-black/75 via-black/45 to-transparent',
        center: 'bg-black/30',
        right: 'bg-gradient-to-l from-black/75 via-black/45 to-transparent',
      }
  const mobileTextSide = slide.position?.endsWith('-right') ? 'right' : slide.position?.endsWith('-left') ? 'left' : slide.textAlign
  const mobileTextWidth = mobileFocus && mobileTextSide !== 'center'
    ? 'max-w-[62%] sm:max-w-xl lg:max-w-2xl'
    : sz.box
  const buttons = (slide.buttons || []).slice(0, 2)
  const desktop = slide.imageDesktop
  const mobile = slide.imageMobile

  let media = null
  if (desktop || mobile) {
    const loading = priority ? 'eager' : 'lazy'
    const mobileObjectPosition = mobile || !mobileFocus
      ? 'object-center'
      : mobileTextSide === 'right'
        ? 'object-[25%_center] sm:object-center'
        : mobileTextSide === 'center'
          ? 'object-center'
          : 'object-[85%_center] sm:object-center'
    const common = { alt: slide.imageAlt || '', loading, decoding: priority ? 'sync' : 'async', draggable: false, className: `absolute inset-0 h-full w-full object-cover ${mobileObjectPosition}` }
    if (priority) common.fetchpriority = 'high'
    if (size === 'mobile') {
      media = <img {...common} src={optimizeImage(mobile || desktop, 900)} />
    } else if (size === 'desktop') {
      media = <img {...common} src={optimizeImage(desktop || mobile, 1920)} />
    } else {
      const base = desktop || mobile
      media = (
        <picture>
          {mobile && <source media="(max-width: 767px)" srcSet={imageSrcSet(mobile, [480, 768]) || mobile} sizes="100vw" />}
          <img
            {...common}
            src={optimizeImage(base, 1920)}
            srcSet={imageSrcSet(base, [768, 1280, 1920])}
            sizes="100vw"
          />
        </picture>
      )
    }
  }

  return (
    <div className={`relative ${isInlineBanner ? 'min-h-[360px] sm:min-h-[400px] lg:min-h-[420px]' : 'h-full'} w-full overflow-hidden bg-gradient-to-br from-header to-route-dark ${className}`}>
      {media}
      {mobileFocus && !mobile && (
        <div aria-hidden="true" className={`absolute inset-0 sm:hidden ${mobileImageShade[mobileTextSide] || mobileImageShade.center}`} />
      )}
      {slide.overlay > 0 && <div aria-hidden="true" className="absolute inset-0 bg-black" style={{ opacity: slide.overlay / 100 }} />}

      <div className={`${isInlineBanner ? 'relative min-h-[360px] sm:min-h-[400px] lg:min-h-[420px]' : 'absolute inset-0'} flex ${sz.pad} ${controls ? sz.padControls : ''} ${position}`}>
        <div className={`${mobileTextWidth} ${align} ${color === 'dark' ? 'text-ink' : 'text-white'} ${isInlineBanner ? '[overflow-wrap:anywhere]' : ''}`}>
          {slide.eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-90">{slide.eyebrow}</p>}
          {slide.title && <h2 className={`font-display font-extrabold leading-[1.05] tracking-tight ${sz.title}`}>{slide.title}</h2>}
          {slide.description && <p className={`mt-3 ${sz.desc}`}>{slide.description}</p>}
          {buttons.length > 0 && (
            <div className={`mt-5 flex flex-wrap gap-3 ${BUTTONS_JUSTIFY[slide.textAlign] ?? 'justify-start'}`}>
              {buttons.map((b, i) => {
                const cls = `${BTN_BASE} ${BTN_STYLES[color][b.style === 'secondary' ? 'secondary' : 'primary']}`
                if (preview) return <span key={i} className={cls}>{b.label}</span>
                return isExternal(b.href) ? (
                  <a key={i} href={b.href} target="_blank" rel="noopener noreferrer" className={cls}>{b.label}</a>
                ) : (
                  <Link key={i} to={b.href} className={cls}>{b.label}</Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}