import React, { useState } from 'react'
import { productShareUrl } from '../../utils/productSharing.js'

export default function ProductShare({ product }) {
  const [message, setMessage] = useState('')
  const url = productShareUrl(product.slug, window.location.origin)
  async function share() {
    try { await navigator.share({ title: product.name, url }); setMessage('') }
    catch (error) { if (error.name !== 'AbortError') setMessage('No se pudo abrir el menú. Puedes copiar el enlace.') }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Enlace copiado.') }
    catch { setMessage('No se pudo copiar automáticamente. Selecciona el enlace para copiarlo.') }
  }
  return <section className="product-share" aria-label="Compartir producto">
    <div>{typeof navigator.share === 'function' && <button type="button" onClick={share}>Compartir producto</button>}
      <button type="button" onClick={copy}>Copiar enlace</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
    </div>
    <p role="status">{message}</p>
    {message.startsWith('No se pudo copiar') && <label>Enlace del producto<input readOnly value={url} onFocus={event => event.target.select()} /></label>}
  </section>
}
