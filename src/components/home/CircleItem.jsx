import React from 'react'
import { Link } from 'react-router-dom'
import { optimizeImage } from '../../utils/imageUrl.js'

// Un círculo: imagen real centrada (object-contain con padding) o, si no hay,
// la inicial del nombre sobre un círculo neutro (sin ícono). El texto va FUERA
// del círculo, centrado y a 2 líneas como máximo.
export const CIRCLE_SIZE = 'h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32'
export const ITEM_WIDTH = 'w-28 sm:w-32 lg:w-36'

export function CircleVisual({ label, image }) {
  const initial = (label || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className={`store-category-visual ${CIRCLE_SIZE} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-4 group-focus-visible:ring-header group-focus-visible:ring-offset-2 dark:bg-white/10 dark:group-focus-visible:ring-sky-300 dark:group-focus-visible:ring-offset-night`}
    >
      {image ? (
        <img
          src={optimizeImage(image, 256)}
          alt=""
          loading="lazy"
          decoding="async"
          width="128"
          height="128"
          draggable="false"
          className="h-full w-full object-contain p-3 sm:p-4"
        />
      ) : (
        <span aria-hidden="true" className="select-none font-display text-3xl font-bold text-ink-soft dark:text-paper/60 sm:text-4xl">
          {initial}
        </span>
      )}
    </span>
  )
}

export default function CircleItem({ label, to, image, external = false, preview = false }) {
  const inner = (
    <>
      <CircleVisual label={label} image={image} />
      <span className="mt-2 line-clamp-2 w-full text-center text-sm font-medium leading-snug text-ink dark:text-paper">{label}</span>
    </>
  )
  const cls = `store-category-link group flex ${ITEM_WIDTH} shrink-0 snap-start flex-col items-center rounded-lg focus-visible:outline-none`
  if (preview) return <span className={cls}>{inner}</span>
  return external ? (
    <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <Link to={to} className={cls}>{inner}</Link>
  )
}