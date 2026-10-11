import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader, readFileAsDataUrl } from '../../components/admin/adminUi.jsx'

const bust = () => {
  invalidate('category-tree')
  invalidate('category:')
}

function Tiles({ category, token }) {
  const toast = useContext(ToastContext)
  const [tiles, setTiles] = useState(null)
  const [draft, setDraft] = useState({ title: '', href: '', image: '' })
  const fail = (e) => toast?.showToast(e.message, 'error')

  useEffect(() => {
    api.admin.getCategoryTiles(category.id, token).then(setTiles).catch(fail)
  }, [category.id])

  const upload = async (file, apply) => {
    if (!file) return
    try {
      const { url } = await api.admin.uploadImage(await readFileAsDataUrl(file), token)
      apply(url)
    } catch (e) {
      fail(new Error(`No se pudo subir la imagen: ${e.message}`))
    }
  }
  const patch = async (tile, data) => {
    try {
      const u = await api.admin.updateCategoryTile(tile.id, data, token)
      setTiles((l) => l.map((t) => (t.id === u.id ? u : t)))
      bust()
    } catch (e) { fail(e) }
  }
  const add = async (e) => {
    e.preventDefault()
    if (!draft.title.trim()) return
    try {
      const t = await api.admin.createCategoryTile(category.id, { title: draft.title.trim(), href: draft.href.trim() || null, image: draft.image || null }, token)
      setTiles((l) => [...l, t])
      setDraft({ title: '', href: '', image: '' })
      bust()
    } catch (err) { fail(err) }
  }
  const remove = async (t) => {
    if (!window.confirm(`¿Eliminar el tile "${t.title}"?`)) return
    try {
      await api.admin.deleteCategoryTile(t.id, token)
      setTiles((l) => l.filter((x) => x.id !== t.id))
      bust()
    } catch (err) { fail(err) }
  }
  const move = async (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= tiles.length) return
    const next = tiles.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setTiles(next.map((t, k) => ({ ...t, position: k })))
    try {
      await Promise.all([api.admin.updateCategoryTile(next[i].id, { position: i }, token), api.admin.updateCategoryTile(next[j].id, { position: j }, token)])
      bust()
    } catch (err) { fail(err) }
  }

  if (!tiles) return <p role="status" className="text-xs text-ink-soft">Cargando tiles…</p>
  return (
    <div className="mt-3 rounded-xl2 bg-paper-surface p-3 dark:bg-night-surface">
      <h4 className="mb-2 text-sm font-semibold text-ink dark:text-paper">Tiles de referencia (página de la categoría)</h4>
      {tiles.length === 0 && <p className="mb-2 text-xs text-ink-soft dark:text-paper/60">Sin tiles todavía.</p>}
      <ul className="space-y-2">
        {tiles.map((t, i) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            {t.image ? <img src={t.image} alt="" className="h-10 w-14 rounded object-cover" /> : <span className="flex h-10 w-14 items-center justify-center rounded bg-route-soft text-[10px] text-route dark:bg-route-softDark">sin img</span>}
            <input aria-label="Título del tile" defaultValue={t.title} onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && patch(t, { title: e.target.value.trim() })} className="input-tr h-8 min-w-[120px] flex-1 py-0" />
            <input aria-label="Enlace del tile" placeholder="/ruta" defaultValue={t.href ?? ''} onBlur={(e) => e.target.value !== (t.href ?? '') && patch(t, { href: e.target.value.trim() || null })} className="input-tr h-8 min-w-[120px] flex-1 py-0 font-mono text-xs" />
            <label className="btn-secondary cursor-pointer px-3 py-1 text-xs">Imagen<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0], (url) => patch(t, { image: url }))} /></label>
            <Check label="Visible" checked={t.visible} onChange={(v) => patch(t, { visible: v })} />
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost p-1.5 disabled:opacity-30"><ArrowUp size={14} /></button>
            <button type="button" aria-label="Bajar" disabled={i === tiles.length - 1} onClick={() => move(i, 1)} className="btn-ghost p-1.5 disabled:opacity-30"><ArrowDown size={14} /></button>
            <button type="button" aria-label="Eliminar tile" onClick={() => remove(t)} className="btn-ghost p-1.5 text-signal-red"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="Título" className="min-w-[140px] flex-1"><input className="input-tr h-8 py-0" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} /></Field>
        <Field label="Enlace" className="min-w-[140px] flex-1"><input className="input-tr h-8 py-0 font-mono text-xs" placeholder="/categoria/…" value={draft.href} onChange={(e) => setDraft({ ...draft, href: e.target.value })} /></Field>
        <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">{draft.image ? 'Imagen ✓' : 'Imagen'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0], (url) => setDraft((d) => ({ ...d, image: url })))} /></label>
        <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={!draft.title.trim()}>Agregar tile</button>
      </form>
    </div>
  )
}

function Node({ node, siblings, index, depth, token, onPatch, onMove, onRemove, onAddChild, expanded, toggle }) {
  const toast = useContext(ToastContext)
  const [name, setName] = useState(node.name)
  const [showTiles, setShowTiles] = useState(false)
  useEffect(() => setName(node.name), [node.name])
  const open = expanded.has(node.id)
  const hasKids = node.children.length > 0

  const uploadImage = async (file) => {
    if (!file) return
    try {
      const { url } = await api.admin.uploadImage(await readFileAsDataUrl(file), token)
      onPatch(node, { image: url })
    } catch (e) { toast?.showToast(`No se pudo subir la imagen: ${e.message}`, 'error') }
  }

  return (
    <li style={{ marginLeft: depth ? 18 : 0 }}>
      <div className={`flex flex-wrap items-center gap-2 rounded-xl2 border p-2 ${node.legacy ? 'border-signal-amber/40 bg-signal-amber/5' : 'border-paper-line dark:border-night-line'}`}>
        <button type="button" onClick={() => toggle(node.id)} aria-expanded={open} aria-label={open ? 'Contraer' : 'Expandir'} className="btn-ghost p-1.5" disabled={!hasKids && !showTiles && false}>
          {hasKids ? (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="inline-block w-4" />}
        </button>
        <input aria-label="Nombre de la categoría" className="input-tr h-9 min-w-[160px] flex-1 py-0" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== node.name && onPatch(node, { name: name.trim() })} maxLength={160} />
        <span className="font-mono text-[11px] text-ink-soft dark:text-paper/50">/{node.slug}</span>
        {node.legacy && <span className="rounded-full bg-signal-amber/15 px-2 py-0.5 text-[11px] font-semibold text-signal-amber">Heredada</span>}
        <span className="text-xs text-ink-soft dark:text-paper/50">{node.productCount ?? 0} prod.</span>
        <Check label="Visible" checked={node.visible} onChange={(v) => onPatch(node, { visible: v })} />
        {node.image && <img src={node.image} alt="" className="h-8 w-12 rounded object-cover" />}
        <label className="btn-secondary cursor-pointer px-3 py-1 text-xs">Imagen<input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadImage(e.target.files?.[0])} /></label>
        <button type="button" onClick={() => setShowTiles((v) => !v)} aria-expanded={showTiles} className="btn-secondary px-3 py-1 text-xs">Tiles</button>
        {!node.legacy && <button type="button" onClick={() => onAddChild(node)} className="btn-secondary px-3 py-1 text-xs"><Plus size={12} className="mr-1 inline" />Sub</button>}
        <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(siblings, index, -1)} className="btn-ghost p-1.5 disabled:opacity-30"><ArrowUp size={14} /></button>
        <button type="button" aria-label="Bajar" disabled={index === siblings.length - 1} onClick={() => onMove(siblings, index, 1)} className="btn-ghost p-1.5 disabled:opacity-30"><ArrowDown size={14} /></button>
        <button type="button" aria-label={`Eliminar ${node.name}`} onClick={() => onRemove(node)} className="btn-ghost p-1.5 text-signal-red"><Trash2 size={14} /></button>
      </div>
      {showTiles && <Tiles category={node} token={token} />}
      {hasKids && open && (
        <ul className="mt-2 space-y-2">
          {node.children.map((c, i) => (
            <Node key={c.id} node={c} siblings={node.children} index={i} depth={depth + 1} token={token} onPatch={onPatch} onMove={onMove} onRemove={onRemove} onAddChild={onAddChild} expanded={expanded} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function AdminCategoryTree() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [form, setForm] = useState({ name: '', parentId: null })
  const fail = (e) => toast?.showToast(e.message, 'error')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setRows(await api.admin.getCategoryTree(token)) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [token])
  useEffect(() => { load() }, [load])

  // Raíces nuevas primero; las heredadas (legacy) agrupadas al final.
  const tree = useMemo(() => {
    const byPos = (a, b) => a.position - b.position || a.name.localeCompare(b.name)
    const build = (parentId) => rows.filter((r) => (r.parentId ?? null) === parentId).sort(byPos).map((r) => ({ ...r, children: build(r.id) }))
    const roots = build(null)
    return [...roots.filter((r) => !r.legacy), ...roots.filter((r) => r.legacy)]
  }, [rows])

  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const onPatch = async (node, data) => {
    try {
      const u = await api.admin.updateCategoryNode(node.id, data, token)
      setRows((l) => l.map((r) => (r.id === u.id ? { ...r, ...u } : r)))
      bust()
    } catch (e) { fail(e); load() }
  }
  const onMove = async (siblings, i, dir) => {
    const j = i + dir
    if (j < 0 || j >= siblings.length) return
    const next = siblings.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows((l) => l.map((r) => { const k = next.findIndex((n) => n.id === r.id); return k >= 0 ? { ...r, position: k } : r }))
    try {
      await Promise.all(next.map((n, k) => (n.position !== k ? api.admin.updateCategoryNode(n.id, { position: k }, token) : null)))
      bust()
    } catch (e) { fail(e); load() }
  }
  const onRemove = async (node) => {
    if (!window.confirm(`¿Eliminar "${node.name}"?`)) return
    try {
      await api.admin.deleteCategoryNode(node.id, token)
      setRows((l) => l.filter((r) => r.id !== node.id))
      bust()
    } catch (e) { fail(e) }
  }
  const add = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      const c = await api.admin.createCategoryNode({ name: form.name.trim(), parentId: form.parentId }, token)
      setRows((l) => [...l, c])
      if (form.parentId) setExpanded((s) => new Set(s).add(form.parentId))
      setForm({ name: '', parentId: null })
      bust()
    } catch (err) { fail(err) }
  }
  const parent = form.parentId ? rows.find((r) => r.id === form.parentId) : null

  return (
    <section aria-labelledby="cats-title">
      <SectionHeader id="cats-title" title="Categorías" description="Árbol del menú. Ocultar una categoría oculta toda su rama. Con el Menú ya configurado, el orden y el nombre de las filas del PRIMER nivel se definen en «Menú»; los niveles inferiores se ordenan aquí. Las «Heredadas» (las 8 originales) no se muestran en la tienda; reasigna sus productos en «Asignar productos»." />
      <form onSubmit={add} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl2 border border-dashed border-paper-line p-3 dark:border-night-line">
        <Field label={parent ? `Nueva subcategoría de «${parent.name}»` : 'Nueva categoría de primer nivel'} className="min-w-[220px] flex-1">
          <input className="input-tr h-9 py-0" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={160} />
        </Field>
        <button type="submit" className="btn-primary px-4 py-2 text-xs" disabled={!form.name.trim()}>Agregar</button>
        {parent && <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setForm({ ...form, parentId: null })}>Cancelar</button>}
      </form>
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando categorías…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!loading && !error && tree.length === 0 && <EmptyRow>No hay categorías. Ejecuta <code>npm run seed:nav</code> o crea la primera.</EmptyRow>}
      <ul className="space-y-2">
        {tree.map((n, i) => (
          <Node key={n.id} node={n} siblings={tree.filter((x) => !!x.legacy === !!n.legacy)} index={tree.filter((x) => !!x.legacy === !!n.legacy).findIndex((x) => x.id === n.id)} depth={0} token={token}
            onPatch={onPatch} onMove={onMove} onRemove={onRemove} onAddChild={(p) => { setForm({ name: '', parentId: p.id }); setExpanded((s) => new Set(s).add(p.id)) }} expanded={expanded} toggle={toggle} />
        ))}
      </ul>
    </section>
  )
}