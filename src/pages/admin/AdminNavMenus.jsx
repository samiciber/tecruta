import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader } from '../../components/admin/adminUi.jsx'

const MENUS = [
  { key: 'acuerdos', label: 'Acuerdos' },
  { key: 'soporte', label: 'Soporte y Servicios' },
  { key: 'descubre', label: 'Descubre' },
  { key: 'mas', label: 'Más' },
  { key: 'quick', label: 'Enlaces rápidos (fila 2)' },
]
const TYPE_LABEL = { LINK: 'Enlace', HEADING: 'Subtítulo', DIVIDER: 'Separador', SUBMENU: 'Con subnivel', PROMO: 'Promo de temporada' }
const NEEDS_HREF = (type) => type === 'LINK'

function ItemRow({ item, siblings, index, token, onSaved, onDeleted, onMove, onAddChild, depth }) {
  const toast = useContext(ToastContext)
  const [draft, setDraft] = useState(item)
  const [busy, setBusy] = useState(false)
  useEffect(() => setDraft(item), [item])
  const dirty = draft.label !== item.label || (draft.href ?? '') !== (item.href ?? '') || draft.visible !== item.visible

  const save = async () => {
    setBusy(true)
    try {
      const updated = await api.admin.updateNavItem(item.id, { label: draft.label, href: NEEDS_HREF(item.type) ? draft.href || null : null, visible: draft.visible }, token)
      onSaved(updated)
      toast?.showToast('Ítem guardado.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    const extra = item.type === 'SUBMENU' ? ' (se eliminarán también sus subitems)' : ''
    if (!window.confirm(`¿Eliminar "${item.label || TYPE_LABEL[item.type]}"?${extra}`)) return
    try {
      await api.admin.deleteNavItem(item.id, token)
      onDeleted(item.id)
    } catch (err) {
      toast?.showToast(err.message, 'error')
    }
  }

  return (
    <li className={depth ? 'ml-6 border-l-2 border-paper-line pl-3 dark:border-night-line' : ''}>
      <div className="flex flex-wrap items-center gap-2 rounded-xl2 border border-paper-line p-2 dark:border-night-line">
        <span className="rounded-full bg-route-soft px-2 py-0.5 text-[11px] font-semibold text-route dark:bg-route-softDark">{TYPE_LABEL[item.type]}</span>
        {item.type === 'DIVIDER' ? (
          <span className="min-w-[120px] flex-1 text-sm text-ink-soft dark:text-paper/60">— línea separadora —</span>
        ) : item.type === 'PROMO' ? (
          <span className="min-w-[160px] flex-1 text-sm text-ink-soft dark:text-paper/60">
            Texto y enlace se editan en <Link to="/admin/ajustes" className="text-route underline">Ajustes del sitio</Link>.
          </span>
        ) : (
          <>
            <input aria-label="Texto" className="input-tr h-9 min-w-[160px] flex-1 py-0" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={120} />
            {NEEDS_HREF(item.type) && (
              <input aria-label="Destino (enlace)" placeholder="/ruta o https://…" className="input-tr h-9 min-w-[160px] flex-1 py-0 font-mono text-xs" value={draft.href ?? ''} onChange={(e) => setDraft({ ...draft, href: e.target.value })} />
            )}
          </>
        )}
        <Check label="Visible" checked={draft.visible} onChange={(v) => setDraft({ ...draft, visible: v })} />
        <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(siblings, index, -1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowUp size={16} /></button>
        <button type="button" aria-label="Bajar" disabled={index === siblings.length - 1} onClick={() => onMove(siblings, index, 1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowDown size={16} /></button>
        {item.type === 'SUBMENU' && (
          <button type="button" onClick={() => onAddChild(item)} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={14} className="mr-1 inline" />Subitem</button>
        )}
        <button type="button" onClick={save} disabled={!dirty || busy} className="btn-primary px-3 py-1.5 text-xs">{busy ? '…' : 'Guardar'}</button>
        <button type="button" aria-label="Eliminar ítem" onClick={remove} className="btn-ghost p-2 text-signal-red"><Trash2 size={16} /></button>
      </div>
      {item.children?.length > 0 && (
        <ul className="mt-2 space-y-2">
          {item.children.map((c, i) => (
            <ItemRow key={c.id} item={c} siblings={item.children} index={i} token={token} onSaved={onSaved} onDeleted={onDeleted} onMove={onMove} onAddChild={onAddChild} depth={1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function AdminNavMenus() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [menu, setMenu] = useState('acuerdos')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ type: 'LINK', label: '', href: '', parentId: null })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await api.admin.getNavItems(menu, token))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [menu, token])
  useEffect(() => { load() }, [load])

  const tree = useMemo(() => {
    const byPos = (a, b) => a.position - b.position
    const parents = rows.filter((r) => !r.parentId).sort(byPos)
    return parents.map((p) => ({ ...p, children: rows.filter((r) => r.parentId === p.id).sort(byPos) }))
  }, [rows])

  const touched = () => { invalidate('nav') }
  const fail = (err) => toast?.showToast(err.message, 'error')

  const move = async (siblings, index, dir) => {
    const target = index + dir
    if (target < 0 || target >= siblings.length) return
    const next = siblings.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    const items = next.map((s, i) => ({ id: s.id, position: i }))
    setRows((l) => l.map((r) => items.find((i) => i.id === r.id) ? { ...r, position: items.find((i) => i.id === r.id).position } : r))
    try {
      await api.admin.reorderNavItems(items, token)
      touched()
    } catch (err) {
      fail(err)
      load()
    }
  }

  const add = async (e) => {
    e.preventDefault()
    const needsLabel = !['DIVIDER', 'PROMO'].includes(form.type)
    if (needsLabel && !form.label.trim()) return
    try {
      const created = await api.admin.createNavItem(
        { menuKey: menu, type: form.type, label: form.label.trim(), href: NEEDS_HREF(form.type) && form.href ? form.href.trim() : null, parentId: form.parentId },
        token,
      )
      setRows((l) => [...l, created])
      setForm({ type: 'LINK', label: '', href: '', parentId: null })
      touched()
    } catch (err) {
      fail(err)
    }
  }
  const parentLabel = form.parentId ? rows.find((r) => r.id === form.parentId)?.label : null

  return (
    <section aria-labelledby="navmenus-title">
      <SectionHeader id="navmenus-title" title="Menús de navegación" description="Edita Acuerdos, Soporte y Servicios, Descubre, Más y los enlaces rápidos de la fila 2: texto, destino, orden y visibilidad. El menú principal (categorías) se edita en Categorías." />
      <div role="tablist" aria-label="Menú a editar" className="mb-4 flex flex-wrap gap-2">
        {MENUS.map((m) => (
          <button key={m.key} role="tab" aria-selected={menu === m.key} type="button" onClick={() => { setMenu(m.key); setForm({ type: 'LINK', label: '', href: '', parentId: null }) }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${menu === m.key ? 'border-route bg-route text-white' : 'border-paper-line text-ink-soft hover:border-ink/30 dark:border-night-line dark:text-paper/70'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={add} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl2 border border-dashed border-paper-line p-3 dark:border-night-line">
        <Field label="Tipo">
          <select className="input-tr h-9 py-0" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(TYPE_LABEL).filter(([t]) => form.parentId ? ['LINK'].includes(t) : true).map(([t, l]) => <option key={t} value={t}>{l}</option>)}
          </select>
        </Field>
        {!['DIVIDER', 'PROMO'].includes(form.type) && (
          <Field label="Texto" className="min-w-[180px] flex-1">
            <input className="input-tr h-9 py-0" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={120} />
          </Field>
        )}
        {NEEDS_HREF(form.type) && (
          <Field label="Destino" className="min-w-[180px] flex-1">
            <input className="input-tr h-9 py-0 font-mono text-xs" placeholder="/proximamente" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} />
          </Field>
        )}
        <button type="submit" className="btn-primary px-4 py-2 text-xs">{parentLabel ? `Agregar bajo «${parentLabel}»` : 'Agregar ítem'}</button>
        {form.parentId && <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setForm({ ...form, parentId: null, type: 'LINK' })}>Cancelar subitem</button>}
      </form>

      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!loading && !error && tree.length === 0 && <EmptyRow>Este menú no tiene ítems.</EmptyRow>}
      <ul className="space-y-2">
        {tree.map((item, i) => (
          <ItemRow key={item.id} item={item} siblings={tree} index={i} token={token} depth={0}
            onSaved={(u) => { setRows((l) => l.map((r) => (r.id === u.id ? u : r))); touched() }}
            onDeleted={(id) => { setRows((l) => l.filter((r) => r.id !== id && r.parentId !== id)); touched() }}
            onMove={move}
            onAddChild={(p) => setForm({ type: 'LINK', label: '', href: '', parentId: p.id })} />
        ))}
      </ul>
    </section>
  )
}