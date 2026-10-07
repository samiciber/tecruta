import React, { useRef } from 'react'
import { X } from 'lucide-react'
import { usePanelBehavior } from '../../../hooks/usePanel.js'

// Panel blanco flotante anclado bajo su botón: título en negrita, X, foco
// atrapado, Esc/clic fuera cierran. `arrow` dibuja la flecha hacia el botón.
export default function FloatingPanel({
  id, title, onClose, triggerRef, width = 'w-[22rem]', align = 'left', arrow = false, hideTitle = false, side = null, children,
}) {
  const ref = useRef(null)
  usePanelBehavior({ open: true, onClose, containerRef: ref, triggerRef })

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={title}
      className={`absolute top-full z-20 mt-2 ${width} max-w-[calc(100vw-1.5rem)] rounded-lg bg-white text-ink shadow-2xl dark:bg-night-surface dark:text-paper ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {arrow && (
        <span aria-hidden="true" className={`absolute -top-1.5 h-3 w-3 rotate-45 bg-white dark:bg-night-surface ${align === 'right' ? 'right-8' : 'left-8'}`} />
      )}
      <div className={`flex items-center justify-between px-5 pt-5 ${hideTitle ? 'pb-0' : 'pb-3'}`}>
        {hideTitle ? <span /> : <h2 className="font-body text-lg font-bold">{title}</h2>}
        <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`} className="-mr-1 rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto overscroll-contain">{children}</div>
      {/* `side`: flotantes de subnivel; van FUERA del área con scroll para que no se recorten. */}
      {side}
    </div>
  )
}