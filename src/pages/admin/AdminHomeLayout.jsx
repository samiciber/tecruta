import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader } from '../../components/admin/adminUi.jsx'
import HomeAdditionalEditor, { createAdditionalSection } from '../../components/admin/HomeAdditionalEditor.jsx'
import { SECTION_LABELS } from '../../components/home/HomeContentSections.jsx'
import ManualProductSource from '../../components/admin/ManualProductSource.jsx'
import { useUnsavedContent } from '../../hooks/useUnsavedContent.js'
import { HomeView } from '../Home.jsx'

const newId = () => `home-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const clone = (value) => JSON.parse(JSON.stringify(value))
const localDateTime = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const SOURCE_LABELS = { featured: 'Destacados', bestSeller: 'Más vendidos', discount: 'Con precio de comparación superior', category: 'Categoría', brand: 'Marca', manual: 'Selección manual' }

function sourceFor(kind, categories, brands) {
  const source = { id: newId(), label: SOURCE_LABELS[kind] || 'Productos', kind }
  if (kind === 'category') {
    const item = categories[0]
    return { ...source, slug: item?.slug || '', label: item?.name || 'Categoría' }
  }
  if (kind === 'brand') {
    const item = brands[0]
    return { ...source, slug: item?.slug || '', label: item?.name || 'Marca' }
  }
  return source
}

function createSection(type, categories, brands) {
  const additional = createAdditionalSection(type, newId)
  if (additional) return additional
  const id = newId()
  if (type === 'hero' || type === 'circles' || type === 'guestStrip') return { id, type, active: true }
  if (type === 'inlineBanners') return { id, type, active: true, slot: 'home-inline' }
  if (type === 'campaign') {
    return {
      id, type, active: true, title: 'Campaña', endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      limit: 8, source: sourceFor('discount', categories, brands),
    }
  }
  return {
    id, type: 'products', active: true, title: 'Productos', limit: 8,
    sources: [sourceFor('featured', categories, brands)],
  }
}

function SourceEditor({ source, categories, brands, onChange, onRemove, canRemove }) {
  const choices = source.kind === 'category' ? categories : source.kind === 'brand' ? brands : []
  const updateKind = (kind) => {
    const next = sourceFor(kind, categories, brands)
    onChange({ ...source, ...next, id: source.id })
  }
  const updateSlug = (slug) => {
    const option = choices.find((item) => item.slug === slug)
    onChange({ ...source, slug, label: option?.name || source.label })
  }
  return (
    <div className="grid gap-3 rounded-lg border border-paper-line p-3 dark:border-night-line sm:grid-cols-2">
      <Field label="Fuente">
        <select className="input-tr h-9 py-0" value={source.kind} onChange={(event) => updateKind(event.target.value)}>
          {Object.entries(SOURCE_LABELS)
            .filter(([value]) => value !== 'category' || categories.length > 0)
            .filter(([value]) => value !== 'brand' || brands.length > 0)
            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      {source.kind === 'manual' && <ManualProductSource source={source} onChange={onChange} />}
      {choices.length > 0 && (
        <Field label={source.kind === 'category' ? 'Categoría' : 'Marca'}>
          <select className="input-tr h-9 py-0" value={source.slug || ''} onChange={(event) => updateSlug(event.target.value)}>
            {choices.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Nombre de pestaña">
        <input className="input-tr h-9 py-0" maxLength={60} value={source.label} onChange={(event) => onChange({ ...source, label: event.target.value })} />
      </Field>
      <Field label="Enlace «Ver todo» (opcional)">
        <input className="input-tr h-9 py-0" maxLength={500} value={source.href || ''} placeholder="/catalogo" onChange={(event) => onChange({ ...source, href: event.target.value || undefined })} />
      </Field>
      {canRemove && <button type="button" onClick={() => { if (window.confirm('¿Quitar esta fuente del borrador?')) onRemove() }} className="btn-ghost w-fit text-xs text-signal-red"><Trash2 size={14} className="mr-1 inline" />Quitar fuente</button>}
    </div>
  )
}

function SectionEditor({ section, index, count, categories, brands, banners, state, onChange, onMove, onRemove }) {
  const typeName = { ...SECTION_LABELS, hero: 'Hero', guestStrip: 'Acceso a cuenta', circles: 'Círculos', products: 'Carrusel de productos', campaign: 'Campaña con cuenta regresiva', inlineBanners: 'Banners inline' }[section.type]
  const patchSource = (sourceIndex, value) => onChange({
    ...section,
    sources: section.sources.map((source, current) => current === sourceIndex ? value : source),
  })
  const moveSource = (index, direction) => {
    const sources = [...section.sources]
    ;[sources[index], sources[index + direction]] = [sources[index + direction], sources[index]]
    onChange({ ...section, sources })
  }
  return (
    <li className="rounded-xl2 border border-paper-line bg-paper-surface p-4 dark:border-night-line dark:bg-night-surface">
      <details open={index === 0}>
      <summary className="mb-4 cursor-pointer font-semibold text-ink dark:text-paper">{index + 1}. {section.title || typeName} · {section.active ? state?.visible ? 'Visible' : 'Sin datos / pendiente' : 'Inactiva'}</summary>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[150px] flex-1">
          <p className="font-semibold text-ink dark:text-paper">{typeName}</p>
          {state && <p className={`mt-1 text-xs ${state.visible ? 'text-signal-green' : 'text-ink-soft dark:text-paper/60'}`}>
            {state.visible
              ? section.type === 'guestStrip' ? 'Habilitada; visible solo para visitantes sin sesión' : `Visible en Home${state.reason ? `: ${state.reason}` : ''}`
              : `No aparece: ${state.reason}`}
          </p>}
          {section.type === 'guestStrip' && (
            <p className="mt-1 text-xs text-ink-soft dark:text-paper/60">
              La activación controla si la sección forma parte del diseño; su contenido solo se muestra a visitantes sin sesión.
            </p>
          )}
        </div>
        <Check label={section.type === 'guestStrip' ? 'Habilitar sección' : 'Activa'} checked={section.active} onChange={(active) => onChange({ ...section, active })} />
        <button type="button" aria-label={`Mover ${typeName} arriba`} disabled={index === 0} onClick={() => onMove(-1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowUp size={16} /></button>
        <button type="button" aria-label={`Mover ${typeName} abajo`} disabled={index === count - 1} onClick={() => onMove(1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowDown size={16} /></button>
        <button type="button" aria-label={`Eliminar ${typeName}`} onClick={() => { if (window.confirm('¿Quitar esta sección y su contenido del borrador?')) onRemove() }} className="btn-ghost p-2 text-signal-red"><Trash2 size={16} /></button>
      </div>

      <HomeAdditionalEditor section={section} onChange={onChange} categories={categories} brands={brands} banners={banners} SourceEditor={SourceEditor} newId={newId} />
      <fieldset className="my-4 grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold">Apariencia</legend><Field label="Superficie de sección"><select className="input-tr" value={section.appearance?.tone || 'default'} onChange={e => onChange({ ...section, appearance: { density: 'normal', ...section.appearance, tone: e.target.value } })}><option value="default">Tema del sitio</option><option value="soft">Fondo suave</option></select></Field><Field label="Espaciado de sección"><select className="input-tr" value={section.appearance?.density || 'normal'} onChange={e => onChange({ ...section, appearance: { tone: 'default', ...section.appearance, density: e.target.value } })}><option value="normal">Normal</option><option value="compact">Compacto</option></select></Field></fieldset>
      {section.type === 'guestStrip' && <div className="my-4 grid gap-3"><Field label="Mensaje para visitantes"><input className="input-tr" maxLength={300} value={section.message ?? 'Accede a tu cuenta para consultar y gestionar tus pedidos.'} onChange={e => onChange({ ...section, message: e.target.value })} /></Field><Field label="Botón de acceso"><input className="input-tr" maxLength={60} value={section.buttonLabel ?? 'Acceder a mi cuenta'} onChange={e => onChange({ ...section, buttonLabel: e.target.value })} /></Field><Field label="Destino de acceso"><input className="input-tr" maxLength={500} value={section.href ?? '/iniciar-sesion'} onChange={e => onChange({ ...section, href: e.target.value })} /></Field></div>}

      {section.type === 'products' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título">
              <input className="input-tr h-9 py-0" maxLength={80} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
            </Field>
            <Field label="Productos por pestaña (1–20)">
              <input type="number" min="1" max="20" className="input-tr h-9 py-0" value={section.limit} onChange={(event) => onChange({ ...section, limit: Number(event.target.value) })} />
            </Field>
          </div>
          <div className="space-y-3">
            {section.sources.map((source, sourceIndex) => (
              <div key={source.id} className="space-y-2"><SourceEditor
                source={source}
                categories={categories}
                brands={brands}
                onChange={(value) => patchSource(sourceIndex, value)}
                onRemove={() => onChange({ ...section, sources: section.sources.filter((_, current) => current !== sourceIndex) })}
                canRemove={section.sources.length > 1}
              /><div className="flex gap-2"><button type="button" className="btn-ghost text-xs" disabled={sourceIndex === 0} onClick={() => moveSource(sourceIndex, -1)}>Subir pestaña</button><button type="button" className="btn-ghost text-xs" disabled={sourceIndex === section.sources.length - 1} onClick={() => moveSource(sourceIndex, 1)}>Bajar pestaña</button></div></div>
            ))}
          </div>
          <button
            type="button"
            disabled={section.sources.length >= 6}
            onClick={() => onChange({ ...section, sources: [...section.sources, sourceFor('featured', categories, brands)] })}
            className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
          >
            <Plus size={14} className="mr-1 inline" />Añadir pestaña/fuente
          </button>
          <fieldset className="rounded-lg border border-paper-line p-3 dark:border-night-line">
            <legend className="px-1 text-xs font-semibold text-ink-soft dark:text-paper/70">Panel lateral opcional</legend>
            {section.panel ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Título del panel"><input className="input-tr h-9 py-0" maxLength={80} value={section.panel.title} onChange={(event) => onChange({ ...section, panel: { ...section.panel, title: event.target.value } })} /></Field>
                <Field label="Descripción"><input className="input-tr h-9 py-0" maxLength={240} value={section.panel.description || ''} onChange={(event) => onChange({ ...section, panel: { ...section.panel, description: event.target.value } })} /></Field>
                <Field label="Texto del enlace"><input className="input-tr h-9 py-0" maxLength={40} value={section.panel.label} onChange={(event) => onChange({ ...section, panel: { ...section.panel, label: event.target.value } })} /></Field>
                <Field label="Enlace"><input className="input-tr h-9 py-0" maxLength={500} value={section.panel.href} onChange={(event) => onChange({ ...section, panel: { ...section.panel, href: event.target.value } })} /></Field>
                <button type="button" onClick={() => { if (!window.confirm('¿Quitar el panel y su contenido del borrador?')) return; const { panel, ...rest } = section; onChange(rest) }} className="btn-ghost w-fit text-xs text-signal-red">Quitar panel</button>
              </div>
            ) : (
              <button type="button" onClick={() => onChange({ ...section, panel: { title: '', description: '', label: '', href: '/catalogo' } })} className="btn-secondary px-3 py-2 text-xs">Agregar panel</button>
            )}
          </fieldset>
        </div>
      )}

      {section.type === 'campaign' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Título configurado de campaña"><input className="input-tr h-9 py-0" maxLength={80} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} /></Field>
          <Field label="Fecha/hora de término">
            <input type="datetime-local" className="input-tr h-9 py-0" value={localDateTime(section.endsAt)} onChange={(event) => onChange({ ...section, endsAt: event.target.value ? new Date(event.target.value).toISOString() : '' })} />
          </Field>
          <Field label="Productos (1–20)"><input type="number" min="1" max="20" className="input-tr h-9 py-0" value={section.limit} onChange={(event) => onChange({ ...section, limit: Number(event.target.value) })} /></Field>
        </div>
      )}

      {section.type === 'inlineBanners' && (
        <div className="mt-4 max-w-sm">
          <Field label="Slot de los banners">
            <input className="input-tr h-9 py-0" maxLength={40} value={section.slot} onChange={(event) => onChange({ ...section, slot: event.target.value })} placeholder="home-inline" />
          </Field>
          <p className="mt-1 text-xs text-ink-soft dark:text-paper/60">Muestra banners completos o parejas de banners a mitad configurados en Banners del Home.</p>
        </div>
      )}
      {section.type === 'campaign' && <fieldset className="mt-4"><legend className="mb-2 text-sm font-semibold">Fuente y enlace de la campaña</legend><SourceEditor source={section.source} categories={categories} brands={brands} onChange={source => onChange({ ...section, source })} /></fieldset>}
      </details>
    </li>
  )
}

export default function AdminHomeLayout() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [layout, setLayout] = useState(null)
  const [saved, setSaved] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [states, setStates] = useState([])
  const [sources, setSources] = useState({ categories: [], brands: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState('products')
  const [saveError, setSaveError] = useState('')
  const [preview, setPreview] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.admin.getHomeLayout(token)
      setLayout(data.layout)
      setSaved(data.layout)
      setDefaults(data.defaults)
      setStates(data.states || [])
      setSources(data.sources || { categories: [], brands: [] })
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => { load() }, [load])

  const dirty = useMemo(() => layout && saved && JSON.stringify(layout) !== JSON.stringify(saved), [layout, saved])
  useUnsavedContent(Boolean(dirty))
  const stateById = useMemo(() => new Map(states.map((item) => [item.id, item])), [states])
  const updateSection = (index, value) => setLayout((current) => ({ ...current, sections: current.sections.map((item, i) => i === index ? value : item) }))
  const move = (index, direction) => setLayout((current) => {
    const sections = current.sections.slice()
    const target = index + direction
    if (target < 0 || target >= sections.length) return current
    ;[sections[index], sections[target]] = [sections[target], sections[index]]
    return { ...current, sections }
  })
  const add = () => setLayout((current) => ({ ...current, sections: [...current.sections, createSection(newType, sources.categories, sources.brands)] }))

  const save = async () => {
    setSaveError('')
    setSaving(true)
    try {
      const result = await api.admin.saveHomeLayout(layout, token)
      setLayout(result.layout)
      setSaved(result.layout)
      setStates(result.states || [])
      toast?.showToast('Diseño del Home guardado.', 'success')
      await load()
    } catch (saveError) {
      setSaveError(saveError.message)
      toast?.showToast(saveError.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    if (!defaults || !window.confirm('¿Restaurar las secciones y el orden iniciales? Los cambios guardados en el diseño actual serán reemplazados.')) return
    setLayout(clone(defaults))
  }

  return (
    <section aria-labelledby="home-layout-title">
      <SectionHeader id="home-layout-title" title="Diseño del Home" description="Ordena y activa las secciones. Las que no tienen contenido válido se ocultan en la tienda y aquí se explica el motivo.">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={!layout} onClick={async () => { try { const result = await api.admin.previewHome(layout, token); setPreview(result); setStates(result.states || []); setSaveError('') } catch (err) { setSaveError(err.message) } }}>Previsualizar borrador</button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={!dirty} onClick={() => { if (window.confirm('¿Descartar los cambios sin guardar?')) { setLayout(clone(saved)); setPreview(null); setSaveError('') } }}>Descartar cambios</button>
          <button type="button" onClick={reset} disabled={loading || !defaults} className="btn-secondary px-3 py-2 text-xs"><RotateCcw size={14} className="mr-1 inline" />Restaurar valores iniciales</button>
          <button type="button" onClick={save} disabled={!dirty || saving || loading} className="btn-primary px-4 py-2 text-xs">{saving ? 'Guardando…' : 'Guardar diseño'}</button>
        </div>
      </SectionHeader>
      {dirty && <p role="status" className="mb-3 text-xs text-signal-amber">Hay cambios sin guardar.</p>}
      {dirty && <p className="mb-3 text-xs text-ink-soft dark:text-paper/70">Previsualiza para actualizar los estados de visibilidad del borrador.</p>}
      {saveError && <p role="alert" className="my-3 text-sm text-red-700 dark:text-red-300">{saveError}</p>}
      {preview && <aside className="my-6 rounded-xl2 border border-paper-line dark:border-night-line"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><h3 className="font-semibold">Previsualización del borrador (sin guardar)</h3><button type="button" className="underline" onClick={() => setPreview(null)}>Cerrar previsualización</button></div><HomeView data={preview} refresh={() => {}} error={null} /></aside>}
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando diseño y fuentes…</p>}
      {error && <p role="alert" className="text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!loading && !error && layout?.sections.length === 0 && <EmptyRow>El diseño está vacío. No se aplicará un diseño alternativo automáticamente.</EmptyRow>}
      {!loading && !error && layout && (
        <>
          <ol className="space-y-3">
            {layout.sections.map((section, index) => (
              <SectionEditor
                key={section.id}
                section={section}
                index={index}
                count={layout.sections.length}
                categories={sources.categories}
                brands={sources.brands}
                banners={sources.banners || []}
                state={stateById.get(section.id)}
                onChange={(value) => updateSection(index, value)}
                onMove={(direction) => move(index, direction)}
                onRemove={() => setLayout((current) => ({ ...current, sections: current.sections.filter((_, currentIndex) => currentIndex !== index) }))}
              />
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <select aria-label="Tipo de sección nueva" className="input-tr h-10 w-auto py-0" value={newType} onChange={(event) => setNewType(event.target.value)}>
              <option value="products">Carrusel de productos</option>
              <option value="campaign">Campaña con cuenta regresiva</option>
              <option value="inlineBanners">Banners inline</option>
              <option value="hero">Hero existente</option>
              <option value="guestStrip">Acceso a cuenta</option>
              <option value="circles">Círculos existentes</option>
              {Object.entries(SECTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={add} disabled={layout.sections.length >= 30} className="btn-secondary px-4 py-2 text-xs disabled:opacity-40"><Plus size={14} className="mr-1 inline" />Agregar sección</button>
          </div>
        </>
      )}
    </section>
  )
}
