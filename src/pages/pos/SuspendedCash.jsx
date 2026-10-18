import React, { useState } from 'react'
import { api } from '../../services/api.js'

export default function SuspendedCash({ sessions, token, onDone }) {
  const [id, setId] = useState('')
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.pos.execute(`/cash/${encodeURIComponent(id)}/reconcile`, {
        requestId: crypto.randomUUID(), countedAmount: counted, reason,
      }, token)
      setId('')
      setCounted('')
      setReason('')
      await onDone()
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  return <section className="pos-panel">
    <h2 className="text-lg font-bold">Conciliar caja de personal suspendido</h2>
    <p className="my-3 text-sm">Cuenta el efectivo y deja un motivo. Se conserva el titular original y queda registro del administrador responsable. Solo se admite personal suspendido; no se reabren cajas cerradas.</p>
    {error && <p role="alert">{error}</p>}
    <form className="space-y-3" onSubmit={submit}>
      <label className="pos-label">Turno abierto a conciliar
        <select aria-label="Turno abierto a conciliar" required className="pos-input" value={id} onChange={event => setId(event.target.value)}>
          <option value="">Seleccionar</option>
          {sessions.filter(session => session.status === 'OPEN').map(session => <option key={session.id} value={session.id}>
            {session.id} · esperado S/ {Number(session.currentExpected).toFixed(2)}
          </option>)}
        </select>
      </label>
      <label className="pos-label">Efectivo contado para conciliación
        <input required className="pos-input" inputMode="decimal" value={counted} onChange={event => setCounted(event.target.value)} />
      </label>
      <label className="pos-label">Motivo de conciliación
        <input required minLength={5} maxLength={240} className="pos-input" value={reason} onChange={event => setReason(event.target.value)} />
      </label>
      <button disabled={busy} className="pos-primary">Confirmar conciliación administrativa</button>
    </form>
  </section>
}
