import { useEffect, useRef } from 'react'

const FOCUSABLE = ':is(a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]):not([tabindex="-1"])'

// Comportamiento común de paneles/popovers: Esc cierra, clic fuera cierra,
// foco inicial dentro, foco atrapado con Tab (trap) y, al cerrar, el foco
// vuelve al elemento que lo tenía antes de abrir.
export function usePanelBehavior({ open, onClose, containerRef, triggerRef, trap = true, autoFocus = true, restoreFocus = true }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const container = containerRef.current
    const previous = document.activeElement
    if (autoFocus && container) {
      const first = container.querySelector('[data-autofocus]') || container.querySelector(FOCUSABLE)
      first?.focus()
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (trap && e.key === 'Tab' && container) {
        const nodes = [...container.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const onDown = (e) => {
      if (container?.contains(e.target) || triggerRef?.current?.contains(e.target)) return
      closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      const active = document.activeElement
      if (restoreFocus && previous?.focus && (active === document.body || container?.contains(active))) previous.focus()
    }
  }, [open, trap, autoFocus, restoreFocus, containerRef, triggerRef])
}
