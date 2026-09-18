import React from 'react'

function MethodDetails({ methodKey, cfg }) {
  if (methodKey === 'yape' || methodKey === 'plin') {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-paper-line bg-paper dark:border-night-line dark:bg-night">
          {cfg.qrImageUrl ? (
            <img src={cfg.qrImageUrl} alt={`Código QR de ${cfg.label}`} className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-[11px] text-ink-soft/60 dark:text-paper/40">
              QR pendiente de configurar
            </span>
          )}
        </div>
        <dl className="flex-1 space-y-1 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-ink-soft dark:text-paper/60">Titular</dt><dd className="font-medium text-ink dark:text-paper">{cfg.holderName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-ink-soft dark:text-paper/60">Número</dt><dd className="font-mono font-medium text-ink dark:text-paper">{cfg.phoneNumber}</dd></div>
        </dl>
      </div>
    )
  }

  if (methodKey === 'bankTransfer') {
    return (
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-ink-soft dark:text-paper/60">Banco</dt><dd className="font-medium text-ink dark:text-paper">{cfg.bankName}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-soft dark:text-paper/60">Titular</dt><dd className="font-medium text-ink dark:text-paper">{cfg.holderName}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-soft dark:text-paper/60">Cuenta</dt><dd className="font-mono font-medium text-ink dark:text-paper">{cfg.accountNumber}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-soft dark:text-paper/60">CCI</dt><dd className="font-mono font-medium text-ink dark:text-paper">{cfg.cci}</dd></div>
      </dl>
    )
  }

  if (methodKey === 'cashOnDelivery') {
    return (
      <p className="text-sm text-ink-soft dark:text-paper/60">
        Disponible para: {(cfg.availableFor || []).join(', ')}.
      </p>
    )
  }

  return null
}

// `methods` viene de usePaymentMethods(): [{ key, label, config }], ya
// filtrados a solo los activos — sean los reales de la BD (editados desde
// el panel admin) o, si la API no respondió, los estáticos de respaldo.
export default function PaymentMethodSelector({ methods, value, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      {methods.map(({ key, label, config }) => {
        const selected = value === key
        return (
          <div
            key={key}
            className={`rounded-xl2 border p-4 transition-colors ${
              selected ? 'border-route bg-route-soft/40 dark:bg-route-softDark/40' : 'border-paper-line dark:border-night-line'
            }`}
          >
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="payment-method"
                checked={selected}
                onChange={() => onChange(key)}
                className="h-4 w-4 text-route focus:ring-route"
              />
              <span className="font-display text-sm font-semibold text-ink dark:text-paper">{label}</span>
            </label>
            {selected && (
              <div className="mt-3 space-y-2 pl-7">
                <MethodDetails methodKey={key} cfg={config} />
                {config.instructions && (
                  <p className="text-xs text-ink-soft/70 dark:text-paper/50">{config.instructions}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

