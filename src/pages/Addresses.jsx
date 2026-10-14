import React, { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Plus, Pencil, Trash2, Star } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'
import SessionUnavailable from '../components/auth/SessionUnavailable.jsx'
import UbigeoSelector from '../components/checkout/UbigeoSelector.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { api } from '../services/api.js'
import { ToastContext } from '../components/ui/ToastProvider.jsx'

const EMPTY_FORM = {
  etiqueta: '',
  departamento: '',
  provincia: '',
  distrito: '',
  direccion: '',
  numero: '',
  interior: '',
  referencia: '',
  isDefault: false,
}

function AddressForm({ initialValue, onCancel, onSaved }) {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [form, setForm] = useState(initialValue || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.departamento || !form.provincia || !form.distrito) {
      setError('Selecciona departamento, provincia y distrito.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = form.id
        ? await api.addresses.update(form.id, form, token)
        : await api.addresses.create(form, token)
      toast?.showToast(form.id ? 'Dirección actualizada' : 'Dirección guardada', 'success')
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl2 border border-paper-line p-5 dark:border-night-line">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Etiqueta (opcional)</span>
        <input type="text" value={form.etiqueta || ''} onChange={set('etiqueta')} placeholder="Casa, Trabajo…" className="input-tr" />
      </label>

      <UbigeoSelector
        value={{ departamento: form.departamento, provincia: form.provincia, distrito: form.distrito }}
        onChange={(ubigeo) => setForm({ ...form, ...ubigeo })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Dirección</span>
          <input type="text" value={form.direccion || ''} onChange={set('direccion')} placeholder="Calle / Av." className="input-tr" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Número</span>
          <input type="text" value={form.numero || ''} onChange={set('numero')} placeholder="123" className="input-tr" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Dpto. / Interior (opcional)</span>
          <input type="text" value={form.interior || ''} onChange={set('interior')} placeholder="Interior 4B" className="input-tr" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Referencia (opcional)</span>
          <input type="text" value={form.referencia || ''} onChange={set('referencia')} placeholder="Cerca a…" className="input-tr" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/60">
        <input
          type="checkbox"
          checked={Boolean(form.isDefault)}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          className="h-4 w-4 rounded text-route focus:ring-route"
        />
        Usar como dirección predeterminada
      </label>

      {error && <p className="text-sm text-signal-red">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : 'Guardar dirección'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function Addresses() {
  const { token, isAuthenticated, authError, retrySession, authLoading } = useAuth()
  const toast = useContext(ToastContext)
  const [addresses, setAddresses] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | address object

  const reload = () => {
    api.addresses
      .list(token)
      .then(setAddresses)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    if (token) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleSaved = () => {
    setEditing(null)
    reload()
  }

  const handleDelete = async (address) => {
    if (!window.confirm(`¿Eliminar la dirección "${address.etiqueta || address.distrito}"?`)) return
    try {
      await api.addresses.remove(address.id, token)
      toast?.showToast('Dirección eliminada', 'success')
      reload()
    } catch (err) {
      toast?.showToast(err.message, 'error')
    }
  }

  const handleSetDefault = async (address) => {
    try {
      await api.addresses.update(address.id, { isDefault: true }, token)
      reload()
    } catch (err) {
      toast?.showToast(err.message, 'error')
    }
  }

  if (authError) return <SessionUnavailable onRetry={retrySession} />
  if (authLoading) return <div role="status" className="container-tr py-16 text-ink dark:text-paper">Comprobando sesión…</div>

  if (!isAuthenticated) {
    return (
      <div className="container-tr py-16">
        <EmptyState
          icon={MapPin}
          title="Inicia sesión para ver tus direcciones"
          description="Guardar direcciones está disponible solo para cuentas registradas."
          action={
            <Link to="/iniciar-sesion" className="btn-primary mt-2">
              Iniciar sesión
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-tr py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Mis direcciones</h1>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')} className="btn-secondary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Agregar dirección
          </button>
        )}
      </div>

      {error && <p className="mb-6 text-sm text-signal-red">{error}</p>}

      {editing === 'new' && (
        <div className="mb-6">
          <AddressForm initialValue={EMPTY_FORM} onCancel={() => setEditing(null)} onSaved={handleSaved} />
        </div>
      )}

      {editing && editing !== 'new' && (
        <div className="mb-6">
          <AddressForm initialValue={editing} onCancel={() => setEditing(null)} onSaved={handleSaved} />
        </div>
      )}

      {!addresses && !error && <p className="text-sm text-ink-soft dark:text-paper/60">Cargando tus direcciones…</p>}

      {addresses && addresses.length === 0 && editing === null && (
        <EmptyState
          icon={MapPin}
          title="Todavía no guardaste ninguna dirección"
          description="Agrega una para no tener que escribirla de nuevo en tu próxima compra."
          action={
            <button type="button" onClick={() => setEditing('new')} className="btn-primary mt-2">
              Agregar dirección
            </button>
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {addresses?.map((address) => (
          <div key={address.id} className="rounded-xl2 border border-paper-line p-5 dark:border-night-line">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-semibold text-ink dark:text-paper">
                  {address.etiqueta || `${address.distrito}, ${address.provincia}`}
                </p>
                {address.isDefault && (
                  <span className="flex items-center gap-1 rounded-full bg-signal-green/15 px-2 py-0.5 text-xs font-medium text-signal-green">
                    <Star className="h-3 w-3 fill-current" /> Predeterminada
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(address)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
                  >
                    Hacer predeterminada
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(address)}
                  aria-label="Editar"
                  className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(address)}
                  aria-label="Eliminar"
                  className="rounded-lg p-1.5 text-signal-red transition-colors hover:bg-signal-red/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-ink-soft dark:text-paper/60">
              {[address.direccion && `${address.direccion} ${address.numero || ''}`.trim(), address.interior, address.distrito, address.provincia, address.departamento]
                .filter(Boolean)
                .join(', ')}
            </p>
            {address.referencia && <p className="mt-1 text-xs text-ink-soft/70 dark:text-paper/50">Ref: {address.referencia}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
