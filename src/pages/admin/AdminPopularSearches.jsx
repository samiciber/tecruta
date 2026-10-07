import React, { useCallback, useContext, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader } from '../../components/admin/adminUi.jsx'

export default function AdminPopularSearches() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [edits, setEdits] = useState({}) // id → texto en edición

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await api.admin.getPopularSearches(token))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const fail = (err) => toast?.showToast(err.message, 'error')

  const add = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const row = await api.admin.createPopularSearch({ text: text.trim() }, token)
      setItems((l) => [...l, row])
      setText('')
      invalidate('popular-searches')
    } catch (err) {
      fail(err)
    }
  }

  const patch = async (id, data) => {
    try {
      const row = await api.admin.updatePopularSearch(id, data, token)
      setItems((l) => l.map((x) => (x.id === id ? row : x)))
      invalidate('popular-searches')
      return row
    } catch (err) {
      fail(err)
    }
  }

  const saveText = async (item) => {
    const value = (edits[item.id] ?? item.text).trim()
    if (!value || value === item.text) return setEdits(({ [item.id]: _, ...rest }) => rest)
    await patch(item.id, { text: value })
    setEdits(({ [item.id]: _, ...rest }) => rest)
  }

  const move = async (index, dir) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = items.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    const updated = next.map((it, i) => ({ ...it, position: i }))
    setItems(updated)
    try {
      await Promise.all(
        updated.filter((it, i) => items.find((o) => o.id === it.id)?.position !== i).map((it) => api.admin.updatePopularSearch(it.id, { position: it.position }, token)),
      )
      invalidate('popular-searches')
    } catch (err) {
      fail(err)
      load()
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.text}"?`)) return
    try {
      await api.admin.deletePopularSearch(item.id, token)
      setItems((l) => l.filter((x) => x.id !== item.id))
      invalidate('popular-searches')
    } catch (err) {
      fail(err)
    }
  }

  return (
    <section aria-labelledby="ps-title">
      <SectionHeader
        id="ps-title"
        title="Búsquedas populares"
        description="Se muestran como chips al enfocar el buscador. «Actualizar» baraja las activas. Cada chip lleva a /catalogo?q=…"
      />
      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Nueva búsqueda" className="min-w-[220px] flex-1">
          <input className="input-tr" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Ej: power bank" />
        </Field>
        <button type="submit" className="btn-primary" disabled={!text.trim()}>
          Agregar
        </button>
      </form>

      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-signal-red">
          {error} <button type="button" onClick={load} className="underline">Reintentar</button>
        </p>
      )}
      {!loading && !error && items.length === 0 && <EmptyRow>Aún no hay búsquedas populares.</EmptyRow>}

      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl2 border border-paper-line p-2 pl-3 dark:border-night-line">
            <span className="w-6 text-xs tabular-nums text-ink-soft dark:text-paper/50">{i + 1}</span>
            <input
              aria-label={`Texto de la búsqueda ${i + 1}`}
              className="input-tr h-9 min-w-[180px] flex-1 py-0"
              value={edits[item.id] ?? item.text}
              onChange={(e) => setEdits((s) => ({ ...s, [item.id]: e.target.value }))}
              onBlur={() => saveText(item)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              maxLength={80}
            />
            <Check label="Activa" checked={item.active} onChange={(v) => patch(item.id, { active: v })} />
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost p-2 disabled:opacity-30">
              <ArrowUp size={16} />
            </button>
            <button type="button" aria-label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="btn-ghost p-2 disabled:opacity-30">
              <ArrowDown size={16} />
            </button>
            <button type="button" aria-label={`Eliminar ${item.text}`} onClick={() => remove(item)} className="btn-ghost p-2 text-signal-red">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}