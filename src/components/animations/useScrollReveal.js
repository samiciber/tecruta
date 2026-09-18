import { useEffect, useRef, useState } from 'react'

// Hook base de todo el storytelling de scroll del sitio. Usa
// IntersectionObserver nativo — sin librería — para saber cuándo un
// elemento entra al viewport, y expone un ref + un booleano "visible"
// para que el componente decida cómo animarse (con clases de Tailwind).
//
// Si el usuario tiene prefers-reduced-motion activado, `visible` arranca
// en `true` de inmediato y jamás se anima: el contenido simplemente
// aparece, sin movimiento.
export function useScrollReveal({ threshold = 0.15, rootMargin = '0px 0px -80px 0px', once = true } = {}) {
  const ref = useRef(null)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [visible, setVisible] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) return // ya se marcó visible de entrada, nada que observar
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true) // navegador sin soporte: mejor mostrar todo que ocultarlo
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            setVisible(false)
          }
        })
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion, threshold, rootMargin, once])

  return { ref, visible }
}
