import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { EmptyRow, Field, SectionHeader } from '../../components/admin/adminUi.jsx'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Asignación masiva de productos a categoría y/o marca.
export default function AdminAssignProducts() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [products, setProducts] = useState([])
  const [cats, setCats] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [onlyLegacy, setOnlyLegacy] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, c, b] = await Promise.all([api.getProducts(), api.admin.getCategoryTree(token), api.admin.getBrands(token)])
      setProducts(p); setCats(c); setBrands(b)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [token])
  useEffect(() => { load() }, [load])

  // Etiquetas con la ruta completa: "Salud › Cuidado personal › Cuidado de la piel"
  const catOptions = useMemo(() => {
    const byId = new Map(cats.map((c) => [c.id, c]))
    const label = (c) => (c.parentId && byId.get(c.parentId) ? `${label(byId.get(c.parentId))} › ${c.name}` : c.name)
    return cats.filter((c) => !c.legacy).map((c) => ({ id: c.id, label: label(c), slug: c.slug })).sort((a, b) => a.label.localeCompare(b.label))
  }, [cats])
  const legacySlugs = useMemo(() => new Set(cats.filter((c) => c.legacy).map((c) => c.slug)), [cats])
  const catName = useMemo(() => Object.fromEntries(cats.map((c) => [c.slug, c.name])), [cats])

  const list = useMemo(() => {
    const n = norm(q.trim())
    return products.filter((p) => (!onlyLegacy || legacySlugs.has(p.category)) && (!n || norm(p.name).includes(n) || norm(p.brand).includes(n)))
  }, [products, q, onlyLegacy, legacySlugs])

  const allChecked = list.length > 0 && list.every((p) => selected.has(p.id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); list.forEach((p) => (allChecked ? n.delete(p.id) : n.add(p.id))); return n })
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const apply = async () => {
    const payload = { productIds: [...selected] }
    if (categoryId) payload.categoryId = categoryId
    if (brandId) payload.brandId = brandId === '__none' ? null : brandId
    if (payload.categoryId === undefined && payload.brandId === undefined) return
    if (!window.confirm(`¿Asignar ${selected.size} producto(s)?`)) return
    setBusy(true)
    try {
      const res = await api.admin.assignProducts(payload, token)
      toast?.showToast(`${res.updated} producto(s) actualizado(s).`, 'success')
      setSelected(new Set()); setCategoryId(''); setBrandId('')
      invalidate('brands'); invalidate('category-tree'); invalidate('category:')
      // El índice de productos de la tienda se carga una vez por sesión: recarga para verlo.
      await load()
    } catch (e) { toast?.showToast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="assign-title">
      <SectionHeader id="assign-title" title="Asignar productos" description="Selecciona productos y asígnalos a una categoría y/o marca en bloque. Los cambios se ven en la tienda al recargar la página." />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Buscar" className="min-w-[200px] flex-1"><input className="input-tr h-9 py-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o marca…" /></Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft dark:text-paper/70"><input type="checkbox" checked={onlyLegacy} onChange={(e) => setOnlyLegacy(e.target.checked)} className="h-4 w-4" />Solo en categorías heredadas</label>
      </div>

      <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-end gap-3 rounded-xl2 border border-paper-line bg-paper-surface p-3 shadow-card dark:border-night-line dark:bg-night-surface">
        <span className="pb-2 text-sm font-semibold text-ink dark:text-paper">{selected.size} seleccionado(s)</span>
        <Field label="Categoría" className="min-w-[220px] flex-1">
          <select className="input-tr h-9 py-0" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— sin cambio —</option>
            {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Marca" className="min-w-[160px]">
          <select className="input-tr h-9 py-0" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">— sin cambio —</option>
            <option value="__none">(quitar marca)</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <button type="button" onClick={apply} disabled={busy || selected.size === 0 || (!categoryId && !brandId)} className="btn-primary px-4 py-2 text-xs">{busy ? 'Aplicando…' : 'Aplicar a la selección'}</button>
      </div>

      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && <p role="alert" className="text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!loading && !error && list.length === 0 && <EmptyRow>No hay productos que coincidan.</EmptyRow>}
      {list.length > 0 && (
        <div className="overflow-x-auto rounded-xl2 border border-paper-line dark:border-night-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-surface text-xs text-ink-soft dark:bg-night-surface dark:text-paper/60">
              <tr>
                <th className="w-10 p-2"><input type="checkbox" aria-label="Seleccionar todos los visibles" checked={allChecked} onChange={toggleAll} className="h-4 w-4" /></th>
                <th className="p-2">Producto</th><th className="p-2">Marca</th><th className="p-2">Categoría actual</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-paper-line dark:border-night-line">
                  <td className="p-2"><input type="checkbox" aria-label={`Seleccionar ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4" /></td>
                  <td className="max-w-[26rem] truncate p-2">{p.name}</td>
                  <td className="p-2">{p.brandSlug ? (brands.find((b) => b.slug === p.brandSlug)?.name ?? p.brandSlug) : <span className="text-signal-amber">sin marca</span>}</td>
                  <td className="p-2">{catName[p.category] ?? p.category}{legacySlugs.has(p.category) && <span className="ml-1 rounded-full bg-signal-amber/15 px-1.5 text-[10px] text-signal-amber">heredada</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}