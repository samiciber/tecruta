import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader } from '../../components/admin/adminUi.jsx'
import { DEFAULT_BRANDS_LABEL, DEFAULT_MENU_TEXTS } from '../../components/layout/header/entries.js'

const validHref = (h) => /^(\/|https?:\/\/)/.test((h || '').trim())
const TYPE_BADGE = { brands: 'Marcas', category: 'Categoría', custom: 'Personalizada' }

// Filas guardadas + categorías raíz que aún no tienen fila (al final, en el orden
// del árbol). Sin layout guardado = el Menú de siempre: «Comprar por marca» + categorías.
function mergeRows(layout, roots) {
  const rows = Array.isArray(layout) ? layout.map((r) => ({ label: '', href: null, visible: true, ...r })) : [{ id: 'brands', type: 'brands', label: '', visible: true }]
  const used = new Set(rows.filter((r) => r.type === 'category').map((r) => r.categoryId))
  for (const c of roots) if (!used.has(c.id)) rows.push({ id: `cat-${c.id}`, type: 'category', categoryId: c.id, label: '', href: null, visible: true })
  return rows
}
const toPayload = (rows) =>
  rows.map((r) => {
    const base = { id: r.id, type: r.type, label: (r.label || '').trim(), visible: r.visible }
    if (r.type === 'category') return { ...base, categoryId: r.categoryId, href: (r.href || '').trim() || null }
    if (r.type === 'custom') return { ...base, href: (r.href || '').trim() }
    return base
  })

export default function AdminMenu() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [roots, setRoots] = useState([])
  const [featured, setFeatured] = useState([])
  const [saved, setSaved] = useState([])
  const [rows, setRows] = useState([])
  const [textsSaved, setTextsSaved] = useState(DEFAULT_MENU_TEXTS)
  const [texts, setTexts] = useState(DEFAULT_MENU_TEXTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingTexts, setSavingTexts] = useState(false)
  const [custom, setCustom] = useState({ label: '', href: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cats, settings, brands] = await Promise.all([api.admin.getCategoryTree(token), api.admin.getSiteSettings(token), api.admin.getBrands(token)])
      const r = cats.filter((c) => !c.legacy && !c.parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      const merged = mergeRows(settings.menuLayout, r)
      const t = { ...DEFAULT_MENU_TEXTS, ...(settings.menuTexts || {}) }
      setRoots(r); setRows(merged); setSaved(merged); setTexts(t); setTextsSaved(t)
      setFeatured(brands.filter((b) => b.featured && b.visible).sort((a, b) => a.featuredPosition - b.featuredPosition || a.name.localeCompare(b.name)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => { load() }, [load])

  const byId = useMemo(() => new Map(roots.map((c) => [c.id, c])), [roots])
  const dirty = JSON.stringify(toPayload(rows)) !== JSON.stringify(toPayload(saved))
  const bad = rows.some((r) => r.type === 'custom' && (!r.label.trim() || !validHref(r.href))) || rows.some((r) => r.type === 'category' && r.href && !validHref(r.href))
  const textsDirty = JSON.stringify(texts) !== JSON.stringify(textsSaved)
  const textsOk = texts.exploreTemplate.trim() && texts.allBrandsLabel.trim()

  const patch = (id, data) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...data } : r)))
  const move = (i, dir) => setRows((l) => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = l.slice(); [n[i], n[j]] = [n[j], n[i]]; return n })
  const addCustom = (e) => {
    e.preventDefault()
    if (!custom.label.trim() || !validHref(custom.href)) return
    setRows((l) => [...l, { id: `u${Date.now().toString(36)}`, type: 'custom', label: custom.label.trim(), href: custom.href.trim(), visible: true }])
    setCustom({ label: '', href: '' })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.admin.saveSiteSetting('menuLayout', toPayload(rows), token)
      const merged = mergeRows(res.menuLayout, roots)
      setRows(merged); setSaved(merged)
      invalidate('site-settings')
      toast?.showToast('Menú guardado.', 'success')
    } catch (e) {
      toast?.showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  const saveTexts = async (e) => {
    e.preventDefault()
    setSavingTexts(true)
    try {
      const res = await api.admin.saveSiteSetting('menuTexts', { exploreTemplate: texts.exploreTemplate.trim(), allBrandsLabel: texts.allBrandsLabel.trim() }, token)
      setTexts(res.menuTexts); setTextsSaved(res.menuTexts)
      invalidate('site-settings')
      toast?.showToast('Textos del Menú guardados.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSavingTexts(false)
    }
  }

  const rowName = (r) => (r.type === 'brands' ? DEFAULT_BRANDS_LABEL : r.type === 'category' ? byId.get(r.categoryId)?.name : r.label)
  // Nombre que ve el visitante (el propio si se editó; si no, el original). Lo usan los aria-label.
  const shownName = (r) => (r.label || '').trim() || rowName(r) || 'fila'
  const preview = rows.filter((r) => r.visible && (r.type !== 'category' || byId.get(r.categoryId)?.visible !== false) && (r.type !== 'category' || byId.has(r.categoryId))).map((r) => (r.label || rowName(r) || '').trim())

  return (
    <section aria-labelledby="menu-title">
      <SectionHeader id="menu-title" title="Menú" description="Panel flotante del botón «Menú»: orden, nombre, destino y visibilidad del primer nivel, filas personalizadas y textos fijos. Los niveles inferiores se editan en Categorías y las marcas destacadas en Marcas; los cambios se ven sin recargar la tienda.">
        <button type="button" onClick={save} disabled={!dirty || bad || saving} className="btn-primary px-4 py-2 text-xs">{saving ? 'Guardando…' : 'Guardar filas'}</button>
      </SectionHeader>
      {dirty && <p role="status" className="mb-3 text-xs text-signal-amber">Tienes cambios sin guardar en las filas.</p>}
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && <p role="alert" className="text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}

      {!loading && !error && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <h3 className="mb-2 font-display text-base font-bold text-ink dark:text-paper">Filas del primer nivel</h3>
            {rows.length === 0 && <EmptyRow>No hay filas.</EmptyRow>}
            <ul className="space-y-2" aria-label="Filas del Menú">
              {rows.map((r, i) => {
                const cat = r.type === 'category' ? byId.get(r.categoryId) : null
                const missing = r.type === 'category' && !cat
                return (
                  <li key={r.id} data-row={r.id} className={`rounded-xl2 border p-3 ${r.visible ? 'border-paper-line dark:border-night-line' : 'border-dashed border-paper-line opacity-70 dark:border-night-line'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-route-soft px-2 py-0.5 text-[11px] font-semibold text-route dark:bg-route-softDark">{TYPE_BADGE[r.type]}</span>
                      {r.type !== 'custom' && <span className="text-sm font-medium text-ink dark:text-paper">{missing ? 'Categoría eliminada' : rowName(r)}</span>}
                      {cat && cat.visible === false && <span className="rounded-full bg-signal-amber/15 px-2 py-0.5 text-[11px] text-signal-amber">Categoría oculta (no sale en la tienda)</span>}
                      <span className="ml-auto flex items-center gap-1">
                        <Check label="Mostrar en el Menú" checked={r.visible} onChange={(v) => patch(r.id, { visible: v })} />
                        <button type="button" aria-label={`Subir ${shownName(r)}`} disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowUp size={16} /></button>
                        <button type="button" aria-label={`Bajar ${shownName(r)}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowDown size={16} /></button>
                        {(r.type === 'custom' || missing) && (
                          <button type="button" aria-label={`Eliminar ${shownName(r)}`} onClick={() => setRows((l) => l.filter((x) => x.id !== r.id))} className="btn-ghost p-2 text-signal-red"><Trash2 size={16} /></button>
                        )}
                      </span>
                    </div>
                    {!missing && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Field label={r.type === 'custom' ? 'Texto visible' : 'Nombre visible (vacío = el original)'}>
                          <input className="input-tr h-9 py-0" value={r.label} maxLength={60} placeholder={r.type === 'custom' ? '' : rowName(r) || ''} onChange={(e) => patch(r.id, { label: e.target.value })} aria-invalid={r.type === 'custom' && !r.label.trim()} />
                        </Field>
                        {r.type !== 'brands' && (
                          <Field label={r.type === 'custom' ? 'Destino (obligatorio)' : 'Destino (vacío = su página de categoría)'}>
                            <input className="input-tr h-9 py-0 font-mono text-xs" value={r.href || ''} placeholder={cat ? `/categoria/${cat.slug}` : '/catalogo'} onChange={(e) => patch(r.id, { href: e.target.value })} aria-invalid={r.type === 'custom' ? !validHref(r.href) : Boolean(r.href) && !validHref(r.href)} />
                          </Field>
                        )}
                      </div>
                    )}
                    {r.type === 'category' && cat && (
                      <p className="mt-2 text-[11px] text-ink-soft dark:text-paper/60">
                        {cat.childCount ? `${cat.childCount} subcategoría(s). ` : 'Sin subcategorías: la fila navega directo al destino. '}
                        <Link to="/admin/categorias" className="inline-flex items-center text-route underline">Editar subniveles <ChevronRight size={12} aria-hidden="true" /></Link>
                      </p>
                    )}
                    {r.type === 'brands' && <p className="mt-2 text-[11px] text-ink-soft dark:text-paper/60">Abre las marcas destacadas. Su destino no cambia; «Todas las marcas» lleva a /marcas.</p>}
                  </li>
                )
              })}
            </ul>

            <form onSubmit={addCustom} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl2 border border-dashed border-paper-line p-3 dark:border-night-line" aria-label="Agregar fila personalizada">
              <Field label="Nueva fila: texto" className="min-w-[160px] flex-1"><input className="input-tr h-9 py-0" value={custom.label} maxLength={60} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="Ej. Ofertas" /></Field>
              <Field label="Destino" className="min-w-[160px] flex-1"><input className="input-tr h-9 py-0 font-mono text-xs" value={custom.href} onChange={(e) => setCustom({ ...custom, href: e.target.value })} placeholder="/catalogo" aria-invalid={Boolean(custom.href) && !validHref(custom.href)} /></Field>
              <button type="submit" className="btn-secondary px-4 py-2 text-xs" disabled={!custom.label.trim() || !validHref(custom.href)}><Plus size={14} className="mr-1 inline" />Agregar fila</button>
            </form>
          </div>

          <aside className="space-y-6">
            <div>
              <h3 className="mb-2 font-display text-base font-bold text-ink dark:text-paper">Vista previa</h3>
              <ol aria-label="Vista previa del primer nivel" className="divide-y divide-paper-line rounded-xl2 border border-paper-line bg-white text-sm dark:divide-night-line dark:border-night-line dark:bg-night-surface">
                {preview.map((l, i) => <li key={i} className="flex items-center justify-between px-3 py-2 text-ink dark:text-paper"><span>{l}</span><ChevronRight size={14} aria-hidden="true" /></li>)}
              </ol>
            </div>

            <form onSubmit={saveTexts} className="rounded-xl2 border border-paper-line p-3 dark:border-night-line">
              <h3 className="mb-2 font-semibold text-ink dark:text-paper">Textos fijos</h3>
              <div className="grid gap-2">
                <Field label="Primer enlace de cada categoría ({name} = su nombre)">
                  <input className="input-tr h-9 py-0" value={texts.exploreTemplate} maxLength={60} onChange={(e) => setTexts({ ...texts, exploreTemplate: e.target.value })} />
                </Field>
                <p className="text-[11px] text-ink-soft dark:text-paper/60">Ejemplo: «{texts.exploreTemplate.replaceAll('{name}', 'Salud') || '…'}»</p>
                <Field label="Último enlace del flotante de marcas">
                  <input className="input-tr h-9 py-0" value={texts.allBrandsLabel} maxLength={40} onChange={(e) => setTexts({ ...texts, allBrandsLabel: e.target.value })} />
                </Field>
              </div>
              <button type="submit" className="btn-primary mt-3 px-4 py-2 text-xs" disabled={!textsDirty || !textsOk || savingTexts}>{savingTexts ? 'Guardando…' : 'Guardar textos'}</button>
            </form>

            <div className="rounded-xl2 border border-paper-line p-3 text-sm dark:border-night-line">
              <h3 className="mb-1 font-semibold text-ink dark:text-paper">Marcas destacadas del flotante</h3>
              {featured.length === 0 ? <p className="text-xs text-ink-soft dark:text-paper/60">Ninguna marca destacada.</p> : (
                <ol className="mb-2 list-decimal pl-5 text-xs text-ink dark:text-paper">{featured.map((b) => <li key={b.id}>{b.name}</li>)}</ol>
              )}
              <Link to="/admin/marcas" className="text-xs text-route underline">Editar en Marcas</Link>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}