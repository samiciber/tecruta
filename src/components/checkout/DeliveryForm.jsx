import React from 'react'
import { Link } from 'react-router-dom'
import { Truck, Store } from 'lucide-react'
import UbigeoSelector from './UbigeoSelector.jsx'

export default function DeliveryForm({ data, onChange }) {
  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({ ...data, [field]: value })
  }
  const setTipoEntrega = (tipo) => onChange({ ...data, tipoEntrega: tipo })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink dark:text-paper">¿Cómo te gustaría recibir tu pedido?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipoEntrega('envio')}
            className={`flex items-center justify-center gap-2 rounded-xl2 border px-4 py-3 text-sm font-medium transition-colors ${
              data.tipoEntrega === 'envio'
                ? 'border-route bg-route-soft text-route dark:bg-route-softDark'
                : 'border-paper-line text-ink-soft hover:border-ink/30 dark:border-night-line dark:text-paper/60'
            }`}
          >
            <Truck className="h-4 w-4" />
            Envío
          </button>
          <button
            type="button"
            onClick={() => setTipoEntrega('recojo')}
            className={`flex items-center justify-center gap-2 rounded-xl2 border px-4 py-3 text-sm font-medium transition-colors ${
              data.tipoEntrega === 'recojo'
                ? 'border-route bg-route-soft text-route dark:bg-route-softDark'
                : 'border-paper-line text-ink-soft hover:border-ink/30 dark:border-night-line dark:text-paper/60'
            }`}
          >
            <Store className="h-4 w-4" />
            Punto de recojo
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink dark:text-paper">
          {data.tipoEntrega === 'recojo' ? 'Zona para coordinar el recojo' : 'Completa tu dirección de entrega'}
        </p>
        <UbigeoSelector
          value={{ departamento: data.departamento, provincia: data.provincia, distrito: data.distrito }}
          onChange={(ubigeo) => onChange({ ...data, ...ubigeo })}
        />
      </div>

      {data.tipoEntrega === 'envio' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Dirección *</span>
            <input type="text" value={data.direccion} onChange={set('direccion')} placeholder="Calle / Av." className="input-tr" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Número *</span>
            <input type="text" value={data.numero} onChange={set('numero')} placeholder="123" className="input-tr" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Dpto. / Interior (opcional)</span>
            <input type="text" value={data.interior} onChange={set('interior')} placeholder="Interior 4B" className="input-tr" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft dark:text-paper/60">Referencia (opcional)</span>
            <input type="text" value={data.referencia} onChange={set('referencia')} placeholder="Cerca a..." className="input-tr" />
          </label>
        </div>
      ) : (
        <p className="rounded-xl2 border border-paper-line bg-paper px-4 py-3 text-xs text-ink-soft dark:border-night-line dark:bg-night dark:text-paper/60">
          Coordinaremos el punto exacto de recojo contigo por WhatsApp según la zona que elijas.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-paper-line pt-4 dark:border-night-line">
        <p className="text-sm font-medium text-ink dark:text-paper">Datos de facturación</p>

        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-soft dark:text-paper/60">
          <input
            type="checkbox"
            checked={data.quiereComprobante}
            onChange={set('quiereComprobante')}
            className="mt-0.5 h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line dark:bg-night-surface"
          />
          Deseo boleta / factura para este pedido
        </label>
        {data.quiereComprobante && (
          <input
            type="text"
            value={data.documento}
            onChange={set('documento')}
            placeholder="DNI o RUC"
            className="input-tr ml-6 max-w-xs"
          />
        )}

        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-soft dark:text-paper/60">
          <input
            type="checkbox"
            checked={data.otraPersona}
            onChange={set('otraPersona')}
            className="mt-0.5 h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line dark:bg-night-surface"
          />
          Otra persona recibirá mi pedido
        </label>
        {data.otraPersona && (
          <div className="ml-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={data.personaNombre}
              onChange={set('personaNombre')}
              placeholder="Nombre de quien recibe"
              className="input-tr"
            />
            <input
              type="tel"
              value={data.personaCelular}
              onChange={set('personaCelular')}
              placeholder="Celular de quien recibe"
              className="input-tr"
            />
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-soft dark:text-paper/60">
          <input
            type="checkbox"
            checked={data.aceptaTerminos}
            onChange={set('aceptaTerminos')}
            className="mt-0.5 h-4 w-4 rounded border-paper-line text-route focus:ring-route dark:border-night-line dark:bg-night-surface"
            required
          />
          <span>
            Declaro que he leído y acepto los{' '}
            <Link to="/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-route hover:underline">
              Términos y Condiciones
            </Link>{' '}
            y la{' '}
            <Link to="/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-route hover:underline">
              Política de Privacidad
            </Link>
          </span>
        </label>
      </div>
    </div>
  )
}