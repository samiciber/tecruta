import React, { useContext, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'

function PaymentMethodCard({ method, token, onSaved }) {
  const toast = useContext(ToastContext)
  const [label, setLabel] = useState(method.label)
  const [active, setActive] = useState(method.active)
  // Solo se editan los campos de texto/número del config (ej: phoneNumber,
  // holderName, bankName, accountNumber, cci) — cualquier otro campo (como
  // arreglos) se conserva tal cual al guardar.
  const editableKeys = Object.entries(method.config).filter(([, v]) => typeof v === 'string' || typeof v === 'number')
  const [fields, setFields] = useState(Object.fromEntries(editableKeys))
  const [saving, setSaving] = useState(false)

  const dirty =
    label !== method.label ||
    active !== method.active ||
    editableKeys.some(([key]) => String(fields[key] ?? '') !== String(method.config[key] ?? ''))

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.admin.updatePaymentMethod(
        method.key,
        { label, active, config: { ...method.config, ...fields } },
        token,
      )
      onSaved(updated)
      toast?.showToast(`"${updated.label}" actualizado.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
      <div className="mb-3 flex items-center justify-between gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="input-tr max-w-[200px] font-semibold" />
        <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft dark:text-paper/60">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-paper-line text-route dark:border-night-line"
          />
          Activo
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {editableKeys.map(([key]) => (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span className="text-ink-soft dark:text-paper/50">{key}</span>
            <input
              value={fields[key] ?? ''}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              className="input-tr h-9 py-0 text-sm"
            />
          </label>
        ))}
      </div>

      <button type="button" onClick={handleSave} disabled={!dirty || saving} className="btn-secondary mt-3">
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}

export default function AdminPaymentMethods() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin
      .getPaymentMethods(token)
      .then(setMethods)
      .catch((err) => toast?.showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleSaved = (updated) => {
    setMethods((list) => list.map((m) => (m.key === updated.key ? updated : m)))
  }

  if (loading) return <p className="text-sm text-ink-soft dark:text-paper/60">Cargando métodos de pago…</p>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {methods.map((method) => (
        <PaymentMethodCard key={method.key} method={method} token={token} onSaved={handleSaved} />
      ))}
    </div>
  )
}