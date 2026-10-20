import React from 'react'
import { Link } from 'react-router-dom'
import { usePaymentMethods } from '../hooks/usePaymentMethods.js'
import { useSiteSettings } from '../hooks/useSiteContent.js'
import { useCachedResource } from '../hooks/useCachedResource.js'
import { api } from '../services/api.js'

export default function Help() {
  const { methods, ready, refresh, refreshing } = usePaymentMethods()
  const { settings } = useSiteSettings()
  const business = settings.storeBusiness || {}
  const { data: footer } = useCachedResource('footer', api.getFooter, { fallback: null })
  return <div className="container-tr py-12">
    <h1 className="mb-8 font-display text-2xl font-bold">Centro de ayuda</h1>
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        {business.shippingText?.trim() && <section id="envios"><h2 className="mb-3 text-lg font-semibold">Envíos</h2><p className="whitespace-pre-line">{business.shippingText}</p></section>}
        {business.warrantyText?.trim() && <section><h2 className="mb-3 text-lg font-semibold">Garantía</h2><p className="whitespace-pre-line">{business.warrantyText}</p></section>}
        <section id="pagos"><h2 className="mb-3 text-lg font-semibold">Métodos de pago</h2>
          {(!ready || !methods.length) && <p role="status">No hay métodos de pago verificados disponibles. <button type="button" className="underline" disabled={refreshing} onClick={() => void refresh().catch(() => {})}>Reintentar</button></p>}
          <ul className="space-y-3">{methods.map(method => <li key={method.key}><strong>{method.label}</strong>{method.config.instructions && <p>{method.config.instructions}</p>}</li>)}</ul>
        </section>
        <section><h2 className="mb-3 text-lg font-semibold">Tus pedidos</h2>
          <p>Si compraste con tu cuenta, consulta el detalle y el estado en <Link className="underline" to="/mis-pedidos">Mis pedidos</Link>.</p>
          <p>Adjuntar un comprobante no confirma automáticamente el pago. El equipo debe verificarlo.</p>
        </section>
        <nav aria-label="Documentos de la tienda" className="flex flex-wrap gap-4">
          <Link className="underline" to="/legal/terminos">Términos y condiciones</Link>
          <Link className="underline" to="/legal/privacidad">Política de privacidad</Link>
          {business.complaintsUrl && <a className="underline" href={business.complaintsUrl} target="_blank" rel="noopener noreferrer">Libro de Reclamaciones</a>}
        </nav>
      </div>
      {(footer?.email || footer?.whatsapp) && <aside><h2 className="mb-3 font-semibold">Contacto</h2>
        {footer.email && <p><a className="underline break-all" href={'mailto:' + footer.email}>{footer.email}</a></p>}
        {footer.whatsapp && <p><a className="underline" href={'https://wa.me/' + footer.whatsapp} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a></p>}
      </aside>}
    </div>
  </div>
}