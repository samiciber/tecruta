import React from 'react'
import { storeConfig } from '../config/storeConfig.js'
import { usePaymentMethods } from '../hooks/usePaymentMethods.js'

const faqs = [
  {
    q: '¿Cuánto demora en llegar mi pedido?',
    a: 'En Lima Metropolitana el delivery se coordina por WhatsApp una vez confirmado el pago, normalmente en 1 a 3 días útiles. Para provincias, el envío se realiza por agencia de transporte y el tiempo depende del destino.',
  },
  {
    q: '¿Puedo pagar contra entrega?',
    a: 'Sí, en las zonas de Lima con delivery coordinado. Selecciona esta opción en el checkout y confírmalo por WhatsApp.',
  },
  {
    q: '¿Qué hago si mi comprobante no se envía automáticamente?',
    a: 'El comprobante que adjuntas en el checkout es solo una referencia local en tu navegador. Para confirmar tu pedido, envíalo por WhatsApp usando el botón "Comprar por WhatsApp".',
  },
]

export default function Help() {
  const { methods: paymentMethods, ready, refresh, refreshing } = usePaymentMethods()

  return (
    <div className="container-tr py-12">
      <h1 className="mb-8 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">
        Preguntas frecuentes
      </h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <section id="envios">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink dark:text-paper">Envíos</h2>
            <ul className="space-y-2 text-sm text-ink-soft dark:text-paper/60">
              {Object.values(storeConfig.shipping).map((option) => (
                <li key={option.label} className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
                  <span className="font-medium text-ink dark:text-paper">{option.label}:</span> {option.detail}
                </li>
              ))}
            </ul>
          </section>

          <section id="pagos">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink dark:text-paper">Métodos de pago</h2>
            {(!ready || !paymentMethods.length) && <p role="status" className="mb-3 text-sm text-ink dark:text-paper">No hay métodos de pago verificados disponibles. <button type="button" disabled={refreshing} onClick={() => void refresh().catch(() => {})} className="font-semibold underline">Reintentar pagos</button></p>}
            <ul className="space-y-2 text-sm text-ink-soft dark:text-paper/60">
              {paymentMethods.map(({ key, label, config }) => (
                <li key={key} className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
                  <span className="font-medium text-ink dark:text-paper">{label}:</span> {config.instructions}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-ink dark:text-paper">Preguntas frecuentes</h2>
            <div className="flex flex-col gap-3">
              {faqs.map((item) => (
                <details key={item.q} className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
                  <summary className="cursor-pointer font-display text-sm font-semibold text-ink dark:text-paper">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm text-ink-soft dark:text-paper/60">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl2 border border-paper-line p-5 dark:border-night-line">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink dark:text-paper">Contacto</h2>
          <p className="mb-1 text-sm text-ink-soft dark:text-paper/60">WhatsApp: {storeConfig.whatsapp.displayNumber}</p>
          <p className="mb-1 text-sm text-ink-soft dark:text-paper/60">Correo: {storeConfig.social.email}</p>
          <p className="mb-1 text-sm text-ink-soft dark:text-paper/60">{storeConfig.hours.weekdays}</p>
          <p className="text-sm text-ink-soft dark:text-paper/60">{storeConfig.hours.saturday}</p>
        </aside>
      </div>
    </div>
  )
}
