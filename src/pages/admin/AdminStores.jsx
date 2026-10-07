import React, { useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader } from '../../components/admin/adminUi.jsx'

const EMPTY = { name: '', address1: '', address2: '', city: '', postalCode: '', opensAt: '', active: true, isDefault: false }

const toPayload = (s) => ({
  name: s.name.trim(),
  address1: s.address1.trim(),
  address2: s.address2?.trim() || null,
  city: s.city.trim(),
  postalCode: s.postalCode?.trim() || null,
  opensAt: s.opensAt || null,
  active: s.active,
  isDefault: s.isDefault,
})

function StoreForm({ initial, submitLabel, busy, onSubmit, onDelete }) {
  const [s, setS] = useState({ ...EMPTY, ...initial, address2: initial?.address2 ?? '', postalCode: initial?.postalCode ?? '', opensAt: initial?.opensAt ?? '' })
  useEffect(() => {
    if (initial) setS({ ...EMPTY, ...initial, address2: initial.address2 ?? '', postalCode: initial.postalCode ?? '', opensAt: initial.opensAt ?? '' })
  }, [initial])
  const set = (patch) => setS((v) => ({ ...v, ...patch }))
  const valid = s.name.trim() && s.address1.trim() && s.city.trim()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(toPayload(s), () => !initial && setS(EMPTY))
      }}
      className="rounded-xl2 border border-paper-line p-4 dark:border-night-line"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre de la tienda *">
          <input className="input-tr h-9 py-0" value={s.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Dirección (calle) *">
          <input className="input-tr h-9 py-0" value={s.address1} onChange={(e) => set({ address1: e.target.value })} maxLength={160} />
        </Field>
        <Field label="Local / piso (opcional)">
          <input className="input-tr h-9 py-0" value={s.address2} onChange={(e) => set({ address2: e.target.value })} maxLength={160} />
        </Field>
        <Field label="Ciudad *">
          <input className="input-tr h-9 py-0" value={s.city} onChange={(e) => set({ city: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Código postal">
          <input className="input-tr h-9 py-0" value={s.postalCode} onChange={(e) => set({ postalCode: e.target.value })} maxLength={20} />
        </Field>
        <Field label="Abre a las">
          <input type="time" className="input-tr h-9 py-0" value={s.opensAt} onChange={(e) => set({ opensAt: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Check label="Activa" checked={s.active} onChange={(v) => set({ active: v })} />
        <Check label="Predeterminada" checked={s.isDefault} onChange={(v) => set({ isDefault: v })} />
        <div className="ml-auto flex gap-2">
          <button type="submit" className="btn-primary px-4 py-2 text-xs" disabled={!valid || busy}>
            {busy ? 'Guardando…' : submitLabel}
          </button>
          {onDelete && (
            <button type="button" className="btn-secondary px-4 py-2 text-xs text-signal-red" onClick={onDelete}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

export default function AdminStores() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStores(await api.admin.getStores(token))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // Cambiar la predeterminada afecta a las demás: se recarga la lista.
  const run = async (id, fn, okMsg) => {
    setBusyId(id)
    try {
      await fn()
      invalidate('stores')
      await load()
      toast?.showToast(okMsg, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="stores-title">
      <SectionHeader
        id="stores-title"
        title="Tiendas"
        description="La tienda predeterminada se muestra en «Tu tienda». Sin tiendas activas, la web muestra «Tienda online»."
      />
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando tiendas…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-signal-red">
          {error} <button type="button" onClick={load} className="underline">Reintentar</button>
        </p>
      )}

      <div className="space-y-4">
        {!loading && !error && stores.length === 0 && <EmptyRow>Aún no hay tiendas. Agrega la primera abajo.</EmptyRow>}
        {stores.map((st) => (
          <StoreForm
            key={st.id}
            initial={st}
            submitLabel="Guardar"
            busy={busyId === st.id}
            onSubmit={(payload) => run(st.id, () => api.admin.updateStore(st.id, payload, token), `"${payload.name}" guardada.`)}
            onDelete={() => window.confirm(`¿Eliminar "${st.name}"?`) && run(st.id, () => api.admin.deleteStore(st.id, token), 'Tienda eliminada.')}
          />
        ))}

        <h3 className="pt-2 font-display text-base font-bold text-ink dark:text-paper">Agregar tienda</h3>
        <StoreForm
          submitLabel="Agregar tienda"
          busy={busyId === 'new'}
          onSubmit={(payload, reset) => run('new', () => api.admin.createStore(payload, token), 'Tienda creada.').then(reset)}
        />
      </div>
    </section>
  )
}