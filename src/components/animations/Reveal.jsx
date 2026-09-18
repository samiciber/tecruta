import React from 'react'
import { useScrollReveal } from './useScrollReveal.js'

const VARIANTS = {
  up: 'translate-y-6',
  down: '-translate-y-6',
  left: 'translate-x-6',
  right: '-translate-x-6',
  none: '',
}

/**
 * Envoltorio reutilizable para animar la entrada de cualquier bloque al
 * hacer scroll. No anima constantemente ni todo el tiempo — se dispara
 * una sola vez cuando el elemento entra al viewport (por defecto) y se
 * queda así. Pensado para usarse alrededor de secciones completas o
 * tarjetas individuales dentro de un .map(), con `delay` para escalonar.
 *
 * Ejemplo:
 *   <Reveal><SomeSection /></Reveal>
 *   {items.map((item, i) => <Reveal key={item.id} delay={i * 60}>...</Reveal>)}
 */
export default function Reveal({ children, as: Tag = 'div', variant = 'up', delay = 0, duration = 600, className = '', ...rest }) {
  const { ref, visible } = useScrollReveal()

  return (
    <Tag
      ref={ref}
      className={`transition-[opacity,transform] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible ? 'translate-x-0 translate-y-0 opacity-100' : `opacity-0 ${VARIANTS[variant] || VARIANTS.up}`
      } ${className}`}
      style={{ transitionDuration: `${duration}ms`, transitionDelay: visible ? `${delay}ms` : '0ms' }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
