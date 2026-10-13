import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, Wand2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { useCategoryTree } from '../../hooks/useSiteContent.js'
import { useProductIndex } from '../../hooks/useProductIndex.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader, readFileAsDataUrl } from '../../components/admin/adminUi.jsx'
import CircleItem, { CircleVisual } from '../../components/home/CircleItem.jsx'
import { DEFAULT_HOME_CIRCLES, resolveCircles } from '../../utils/homeCircles.js'

const MAX_IMAGE_MB = 10
const validHref = (h) => /^(\/|https?:\/\/)/.test((h || '').trim())

const toPayload = (c) => ({
  title: c.title.trim(),
  onlyWithProducts: c.onlyWithProducts,
  max: c.max === '' || c.max === null || Number.isNaN(c.max) ? null : Number(c.max),
  items: c.items === null ? null : c.items.map((r) => (r.type === 'custom'
    ? { id: r.id, type: 'custom', label: r.label.trim(), href: r.href.trim(), image: r.image || null, visible: r.visible }
    : { id: r.id, type: 'category', categoryId: r.categoryId, label: (r.label || '').trim(), image: r.image || null, visible: r.visible })),
})

function ImagePicker({ value, onChange, token, label }) {
  const toast = useContext(ToastContext)
  const [busy, setBusy] = useState(false)
  const upload = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast?.showToast('El archivo debe ser una imagen.', 'error')
    if (file.size > MAX_IMAGE_MB * 1048576) return toast?.showToast(`La imagen pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${MAX_IMAGE_MB} MB.`, 'error')
    setBusy(true)
    try {
      const { url } = await api.admin.uploadImage(await readFileAsDataUrl(file), token)
      onChange(url)
    } catch (e) {
      toast?.showToast(`No se pudo subir la imagen: ${e.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-2">
      <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
        {busy ? 'Subiendo…' : value ? 'Cambiar imagen' : label}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {value && <button type="button" className="btn-ghost px-2 py-1.5 text-xs" onClick={() => onChange(null)}>Quitar</button>}
    </div>
  )
}

export default function AdminHomeCircles() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [cats, setCats] = useState([])
  const [saved, setSaved] = useState(DEFAULT_HOME_CIRCLES)
  const [cfg, setCfg] = useState(DEFAULT_HOME_CIRCLES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pick, setPick] = useState('')
  const [custom, setCustom] = useState({ label: '', href: '' })
  // La vista previa usa los datos PÚBLICOS (lo que de verdad verá el visitante).
  const { tree } = useCategoryTree()
  const { index: products } = useProductIndex()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, settings] = await Promise.all([api.admin.getCategoryTree(token), api.admin.getSiteSettings(token)])
      const c = { ...DEFAULT_HOME_CIRCLES, ...(settings.homeCircles || {}) }
      c.items = Array.isArray(c.items) ? c.items.map((r) => ({ label: '', image: null, visible: true, ...r })) : null
      setCats(rows.filter((r) => !r.legacy))
      setSaved(c)
      setCfg(c)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => { load() }, [load])

  // Datos derivados de la lista plana del admin: ruta, productos de TODA la rama, visibilidad real.
  const info = useMemo(() => {
    const byId = new Map(cats.map((c) => [c.id, c]))
    const kids = new Map()
    cats.forEach((c) => kids.set(c.parentId ?? null, [...(kids.get(c.parentId ?? null) || []), c]))
    const total = (c) => (c.productCount || 0) + (kids.get(c.id) || []).reduce((n, k) => n + total(k), 0)
    const path = (c) => (c.parentId && byId.get(c.parentId) ? `${path(byId.get(c.parentId))} › ${c.name}` : c.name)
    const hidden = (c) => c.visible === false || (c.parentId && byId.get(c.parentId) ? hidden(byId.get(c.parentId)) : false)
    const out = new Map()
    cats.forEach((c) => out.set(c.id, { cat: c, path: path(c), total: total(c), hidden: hidden(c) }))
    return out
  }, [cats])

  const dirty = JSON.stringify(toPayload(cfg)) !== JSON.stringify(toPayload(saved))
  const maxNum = cfg.max === '' || cfg.max === null ? null : Number(cfg.max)
  const maxOk = maxNum === null || (Number.isInteger(maxNum) && maxNum >= 1 && maxNum <= 200)
  const itemsBad = Array.isArray(cfg.items) && cfg.items.some((r) => r.type === 'custom' && (!r.label.trim() || !validHref(r.href)))
  const canSave = dirty && cfg.title.trim() && maxOk && !itemsBad

  const used = new Set((cfg.items || []).filter((r) => r.type === 'category').map((r) => r.categoryId))
  const options = cats.filter((c) => !used.has(c.id)).map((c) => ({ id: c.id, label: info.get(c.id).path })).sort((a, b) => a.label.localeCompare(b.label))

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }))
  const setItems = (fn) => setCfg((c) => ({ ...c, items: fn(c.items || []) }))
  const patchItem = (id, data) => setItems((l) => l.map((r) => (r.id === id ? { ...r, ...data } : r)))
  const move = (i, dir) => setItems((l) => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = l.slice(); [n[i], n[j]] = [n[j], n[i]]; return n })

  const autofill = () => {
    if (Array.isArray(cfg.items) && cfg.items.length > 0 && !window.confirm('Esto reemplaza tu lista actual por las categorías visibles de primer nivel. ¿Continuar?')) return
    const roots = cats.filter((c) => !c.parentId && c.visible !== false).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    set({ items: roots.map((c) => ({ id: `cat-${c.id}`, type: 'category', categoryId: c.id, label: '', image: null, visible: true })) })
  }
  const addCategory = () => {
    if (!pick) return
    setItems((l) => [...l, { id: `cat-${pick}`, type: 'category', categoryId: pick, label: '', image: null, visible: true }])
    setPick('')
  }
  const addCustom = (e) => {
    e.preventDefault()
    if (!custom.label.trim() || !validHref(custom.href)) return
    setItems((l) => [...l, { id: `u${Date.now().toString(36)}`, type: 'custom', label: custom.label.trim(), href: custom.href.trim(), image: null, visible: true }])
    setCustom({ label: '', href: '' })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.admin.saveSiteSetting('homeCircles', toPayload(cfg), token)
      const c = { ...DEFAULT_HOME_CIRCLES, ...res.homeCircles }
      c.items = Array.isArray(c.items) ? c.items.map((r) => ({ label: '', image: null, visible: true, ...r })) : null
      setSaved(c); setCfg(c)
      invalidate('site-settings')
      toast?.showToast('Círculos guardados.', 'success')
    } catch (e) {
      toast?.showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const previewItems = useMemo(
    () => resolveCircles({ config: { ...cfg, max: maxOk ? maxNum : null, title: cfg.title }, tree, products }),
    [cfg, tree, products, maxOk, maxNum],
  )

  return (
    <section aria-labelledby="circles-admin-title">
      <SectionHeader id="circles-admin-title" title="Círculos de la Home" description="Fila de círculos «Compra por categoría». Sin lista elegida se muestran automáticamente las categorías visibles de primer nivel. Aquí puedes elegir cuáles, su orden, cambiar su nombre o imagen y agregar círculos personalizados (por ejemplo «Ofertas» o «Más vendidos»).">
        <button type="button" onClick={save} disabled={!canSave || saving} className="btn-primary px-4 py-2 text-xs">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </SectionHeader>
      {dirty && <p role="status" className="mb-3 text-xs text-signal-amber">Tienes cambios sin guardar.</p>}
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && <p role="alert" className="text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 rounded-xl2 border border-paper-line p-4 dark:border-night-line sm:grid-cols-3">
            <Field label="Título de la sección">
              <input className="input-tr h-9 py-0" value={cfg.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} aria-invalid={!cfg.title.trim()} />
            </Field>
            <Field label="Máximo de ítems (vacío = todos)">
              <input type="number" min="1" max="200" className="input-tr h-9 py-0" value={cfg.max ?? ''} aria-invalid={!maxOk}
                onChange={(e) => set({ max: e.target.value === '' ? null : Number(e.target.value) })} />
              {!maxOk && <span className="text-signal-red">Entero entre 1 y 200.</span>}
            </Field>
            <div className="flex items-end pb-2">
              <Check label="Mostrar solo categorías con productos" checked={cfg.onlyWithProducts} onChange={(v) => set({ onlyWithProducts: v })} />
            </div>
            <p className="text-[11px] text-ink-soft dark:text-paper/60 sm:col-span-3">
              El filtro «solo con productos» cuenta los productos de la categoría y de todas sus subcategorías, y no afecta a los círculos personalizados. Con productos asignados a pocas categorías, desactivarlo mostrará más círculos, pero algunos llevarán a una página «Aún no tenemos productos».
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-display text-base font-bold text-ink dark:text-paper">Vista previa (lo que ve el visitante)</h3>
            {previewItems.length === 0 ? <EmptyRow>Con esta configuración la sección no se mostraría (no hay ítems).</EmptyRow> : (
              <div className="pointer-events-none flex gap-4 overflow-hidden rounded-xl2 border border-paper-line p-4 dark:border-night-line" aria-label="Vista previa de los círculos">
                {previewItems.slice(0, 8).map((c) => <CircleItem key={c.key} label={c.label} to={c.to} image={c.image} preview />)}
              </div>
            )}
            <p className="mt-1 text-[11px] text-ink-soft dark:text-paper/60">{previewItems.length} círculo(s) en total{previewItems.length > 8 ? ' (se muestran los primeros 8)' : ''}.</p>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-ink dark:text-paper">Ítems</h3>
              <div className="flex gap-2">
                <button type="button" onClick={autofill} className="btn-secondary px-3 py-1.5 text-xs"><Wand2 size={14} className="mr-1 inline" />Autollenar desde categorías visibles</button>
                {cfg.items !== null && <button type="button" onClick={() => set({ items: null })} className="btn-ghost px-3 py-1.5 text-xs">Volver a automático</button>}
              </div>
            </div>

            {cfg.items === null ? (
              <EmptyRow>Modo automático: se muestran las categorías visibles de primer nivel en el orden de «Categorías». Pulsa «Autollenar» para elegir cuáles, ordenarlas o agregar círculos personalizados.</EmptyRow>
            ) : (
              <>
                {cfg.items.length === 0 && <EmptyRow>No hay ítems: la sección no se mostrará. Agrega categorías o círculos personalizados.</EmptyRow>}
                <ul className="space-y-2" aria-label="Ítems de la fila de círculos">
                  {cfg.items.map((r, i) => {
                    const d = r.type === 'category' ? info.get(r.categoryId) : null
                    const missing = r.type === 'category' && !d
                    const name = r.type === 'custom' ? r.label : d?.cat.name
                    const thumb = r.image || d?.cat.image || null
                    const shown = (r.label || '').trim() || name || 'ítem'
                    return (
                      <li key={r.id} data-item={r.id} className={`rounded-xl2 border p-3 ${r.visible ? 'border-paper-line dark:border-night-line' : 'border-dashed border-paper-line opacity-70 dark:border-night-line'}`}>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="scale-[0.4] origin-left -mr-14 -my-10"><CircleVisual label={shown} image={thumb} /></span>
                          <div className="min-w-[160px] flex-1">
                            <p className="truncate text-sm font-semibold text-ink dark:text-paper">{missing ? 'Categoría eliminada' : r.type === 'custom' ? 'Círculo personalizado' : d.path}</p>
                            <p className="flex flex-wrap gap-1 pt-0.5 text-[11px]">
                              <span className="rounded-full bg-route-soft px-2 py-0.5 font-semibold text-route dark:bg-route-softDark">{r.type === 'custom' ? 'Personalizado' : 'Categoría'}</span>
                              {d && d.total === 0 && <span className="rounded-full bg-signal-amber/15 px-2 py-0.5 text-signal-amber">Sin productos{cfg.onlyWithProducts ? ' · oculta por el filtro' : ''}</span>}
                              {d && d.hidden && <span className="rounded-full bg-signal-amber/15 px-2 py-0.5 text-signal-amber">Categoría oculta · no se muestra</span>}
                              {d && d.total > 0 && <span className="rounded-full bg-signal-green/15 px-2 py-0.5 text-signal-green">{d.total} producto(s)</span>}
                            </p>
                          </div>
                          <Check label="Visible" checked={r.visible} onChange={(v) => patchItem(r.id, { visible: v })} />
                          <button type="button" aria-label={`Subir ${shown}`} disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowUp size={16} /></button>
                          <button type="button" aria-label={`Bajar ${shown}`} disabled={i === cfg.items.length - 1} onClick={() => move(i, 1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowDown size={16} /></button>
                          <button type="button" aria-label={`Eliminar ${shown}`} onClick={() => setItems((l) => l.filter((x) => x.id !== r.id))} className="btn-ghost p-2 text-signal-red"><Trash2 size={16} /></button>
                        </div>
                        {!missing && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <Field label={r.type === 'custom' ? 'Texto (obligatorio)' : 'Etiqueta (vacío = nombre de la categoría)'}>
                              <input className="input-tr h-9 py-0" value={r.label} maxLength={60} placeholder={r.type === 'custom' ? '' : name} onChange={(e) => patchItem(r.id, { label: e.target.value })} aria-invalid={r.type === 'custom' && !r.label.trim()} />
                            </Field>
                            {r.type === 'custom' ? (
                              <Field label="Enlace (obligatorio)">
                                <input className="input-tr h-9 py-0 font-mono text-xs" value={r.href} placeholder="/catalogo" onChange={(e) => patchItem(r.id, { href: e.target.value })} aria-invalid={!validHref(r.href)} />
                              </Field>
                            ) : <span />}
                            <div className="flex items-end"><ImagePicker value={r.image} label={r.type === 'custom' ? 'Subir imagen' : 'Imagen propia'} token={token} onChange={(url) => patchItem(r.id, { image: url })} /></div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="flex items-end gap-2 rounded-xl2 border border-dashed border-paper-line p-3 dark:border-night-line">
                    <Field label="Agregar una categoría" className="flex-1">
                      <select className="input-tr h-9 py-0" value={pick} onChange={(e) => setPick(e.target.value)}>
                        <option value="">Elige una categoría…</option>
                        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </Field>
                    <button type="button" onClick={addCategory} disabled={!pick} className="btn-secondary px-3 py-2 text-xs"><Plus size={14} className="mr-1 inline" />Agregar</button>
                  </div>
                  <form onSubmit={addCustom} aria-label="Agregar círculo personalizado" className="flex flex-wrap items-end gap-2 rounded-xl2 border border-dashed border-paper-line p-3 dark:border-night-line">
                    <Field label="Círculo personalizado: texto" className="min-w-[120px] flex-1"><input className="input-tr h-9 py-0" value={custom.label} maxLength={60} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="Ej. Ofertas" /></Field>
                    <Field label="Enlace" className="min-w-[120px] flex-1"><input className="input-tr h-9 py-0 font-mono text-xs" value={custom.href} onChange={(e) => setCustom({ ...custom, href: e.target.value })} placeholder="/catalogo" aria-invalid={Boolean(custom.href) && !validHref(custom.href)} /></Field>
                    <button type="submit" className="btn-secondary px-3 py-2 text-xs" disabled={!custom.label.trim() || !validHref(custom.href)}><Plus size={14} className="mr-1 inline" />Agregar</button>
                  </form>
                </div>
                <p className="mt-2 text-[11px] text-ink-soft dark:text-paper/60">Imagen recomendada: PNG o WebP de unos 400×400 px, con fondo transparente o blanco (se muestra completa dentro del círculo). Máximo 10 MB. Sin imagen se muestra la inicial del nombre.</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}