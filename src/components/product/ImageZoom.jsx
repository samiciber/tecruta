import React, { useEffect, useRef } from 'react'
import { optimizeImage } from '../../utils/imageUrl.js'

export default function ImageZoom({ images, active, name, onSelect, onClose, returnFocusRef }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = returnFocusRef?.current || document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  const step = direction => onSelect((active + direction + images.length) % images.length)
  return <dialog ref={ref} className="store-image-zoom" aria-label={`Imagen ampliada de ${name}`}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === ref.current) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose() } }}
    onKeyDown={event => {
      if (images.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1) }
    }}>
    <header><span>{name}</span><button type="button" autoFocus onClick={onClose}>Cerrar ampliación</button></header>
    <img src={optimizeImage(images[active], 2400)} width="1200" height="1200" alt={`${name}, imagen ${active + 1} de ${images.length}`} />
    {images.length > 1 && <footer><button type="button" onClick={() => step(-1)}>Imagen anterior</button><span aria-live="polite">{active + 1} de {images.length}</span><button type="button" onClick={() => step(1)}>Imagen siguiente</button></footer>}
  </dialog>
}
