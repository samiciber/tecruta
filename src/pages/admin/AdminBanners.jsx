import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader, readFileAsDataUrl } from '../../components/admin/adminUi.jsx'
import HeroSlide from '../../components/home/HeroSlide.jsx'

const MAX_IMAGE_MB = 10
const POSITIONS = [
  ['top-left', 'Arriba izquierda'], ['top-center', 'Arriba centro'], ['top-right', 'Arriba derecha'],
  ['middle-left', 'Centro izquierda'], ['middle-center', 'Centro'], ['middle-right', 'Centro derecha'],
  ['bottom-left', 'Abajo izquierda'], ['bottom-center', 'Abajo centro'], ['bottom-right', 'Abajo derecha'],
]
const ALIGNS = [
  ['left', 'Izquierda', AlignLeft], ['center', 'Centrado', AlignCenter], ['right', 'Derecha', AlignRight], ['justify', 'Justificado', AlignJustify],
]

const newBanner = () => ({
  id: `b${Date.now().toString(36)}`, eyebrow: '', title: '', description: '', buttons: [], imageDesktop: null, imageMobile: null, imageAlt: '',
  position: 'bottom-left', textAlign: 'left', textColor: 'light', overlay: 35, active: true, startsAt: null, endsAt: null, placement: 'hero', width: 'full', slot: '',
})
const validHref = (h) => /^(\/|https?:\/\/)/.test((h || '').trim())
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

// Problemas que impiden guardar (mismas reglas que la API).
function problems(b) {
  const out = []
  if (!b.title.trim() && !b.imageDesktop) out.push('Necesita al menos un título o una imagen de escritorio.')
  b.buttons.forEach((btn, i) => {
    if (!btn.label.trim()) out.push(`Botón ${i + 1}: falta el texto.`)
    if (!validHref(btn.href)) out.push(`Botón ${i + 1}: el enlace debe empezar con «/» o «https://».`)
  })
  if (b.startsAt && b.endsAt && new Date(b.endsAt) <= new Date(b.startsAt)) out.push('La fecha de fin debe ser posterior a la de inicio.')
  return out
}

// Escala un slide de tamaño real (ej. 1440×450) para que quepa en su caja:
// la vista previa se ve EXACTAMENTE como en la Home, no una aproximación.
function ScaledPreview({ baseW, baseH, children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.4)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => setScale(Math.min(1, el.clientWidth / baseW))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [baseW])
  return (
    <div ref={ref} className="w-full" style={{ height: baseH * scale }}>
      <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

function ImageField({ label, hint, value, onChange, token, testId }) {
  const toast = useContext(ToastContext)
  const [busy, setBusy] = useState(false)
  const upload = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast?.showToast('El archivo debe ser una imagen.', 'error')
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return toast?.showToast(`La imagen pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${MAX_IMAGE_MB} MB.`, 'error')
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
    <div className="rounded-xl2 border border-paper-line p-3 dark:border-night-line">
      <p className="text-xs font-semibold text-ink dark:text-paper">{label}</p>
      <p className="mb-2 text-[11px] text-ink-soft dark:text-paper/60">{hint}</p>
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="h-14 w-24 rounded object-cover" /> : <span className="flex h-14 w-24 items-center justify-center rounded bg-route-soft text-[11px] text-route dark:bg-route-softDark">Sin imagen</span>}
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
            {busy ? 'Subiendo…' : value ? 'Cambiar' : 'Subir imagen'}
            <input data-testid={testId} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {value && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onChange(null)}>Quitar</button>}
        </div>
      </div>
    </div>
  )
}

function Editor({ banner, onChange, token }) {
  const [mode, setMode] = useState('desktop')
  const set = (patch) => onChange({ ...banner, ...patch })
  const setBtn = (i, patch) => set({ buttons: banner.buttons.map((b, k) => (k === i ? { ...b, ...patch } : b)) })
  const issues = problems(banner)

  return (
    <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <ImageField testId="img-desktop" label="Imagen de escritorio" hint="Recomendado: 1920×600 px (JPG o WebP). Máximo 10 MB; ideal menos de 500 KB para que cargue rápido. Si no hay imagen se usa el degradado de marca." value={banner.imageDesktop} onChange={(v) => set({ imageDesktop: v })} token={token} />
        <ImageField testId="img-mobile" label="Imagen para móvil (opcional)" hint="Recomendado: 900×1100 px. Si la dejas vacía, en móvil se recorta la de escritorio." value={banner.imageMobile} onChange={(v) => set({ imageMobile: v })} token={token} />
        <Field label="Texto alternativo de la imagen (accesibilidad)"><input className="input-tr h-9 py-0" value={banner.imageAlt} maxLength={160} onChange={(e) => set({ imageAlt: e.target.value })} placeholder="Déjalo vacío si la imagen es decorativa" /></Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título"><input className="input-tr h-9 py-0" value={banner.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Etiqueta superior (opcional)"><input className="input-tr h-9 py-0" value={banner.eyebrow} maxLength={60} onChange={(e) => set({ eyebrow: e.target.value })} /></Field>
          <Field label="Descripción" className="sm:col-span-2"><textarea className="input-tr min-h-[64px] py-2" value={banner.description} maxLength={240} onChange={(e) => set({ description: e.target.value })} /></Field>
        </div>

        <fieldset className="rounded-xl2 border border-paper-line p-3 dark:border-night-line">
          <legend className="px-1 text-xs font-semibold text-ink dark:text-paper">Botones (hasta 2)</legend>
          {banner.buttons.map((btn, i) => (
            <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Field label={`Texto ${i + 1}`}><input className="input-tr h-9 py-0" value={btn.label} maxLength={40} onChange={(e) => setBtn(i, { label: e.target.value })} /></Field>
              <Field label={`Enlace ${i + 1}`}><input className="input-tr h-9 py-0 font-mono text-xs" value={btn.href} aria-invalid={!validHref(btn.href)} onChange={(e) => setBtn(i, { href: e.target.value })} placeholder="/catalogo" /></Field>
              <Field label="Estilo">
                <select className="input-tr h-9 py-0" value={btn.style} onChange={(e) => setBtn(i, { style: e.target.value })}>
                  <option value="primary">Primario</option><option value="secondary">Secundario</option>
                </select>
              </Field>
              <button type="button" aria-label={`Quitar botón ${i + 1}`} className="btn-ghost mt-5 p-2 text-signal-red" onClick={() => set({ buttons: banner.buttons.filter((_, k) => k !== i) })}><Trash2 size={16} /></button>
            </div>
          ))}
          {banner.buttons.length < 2 && (
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => set({ buttons: [...banner.buttons, { label: '', href: '/catalogo', style: banner.buttons.length === 0 ? 'primary' : 'secondary' }] })}>
              <Plus size={14} className="mr-1 inline" />Agregar botón
            </button>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-ink-soft dark:text-paper/60">Posición del texto</legend>
            <div role="radiogroup" aria-label="Posición del texto" className="grid w-36 grid-cols-3 gap-1 rounded-lg border border-paper-line p-1 dark:border-night-line">
              {POSITIONS.map(([key, label]) => (
                <button key={key} type="button" role="radio" aria-checked={banner.position === key} aria-label={label} title={label} data-pos={key}
                  onClick={() => set({ position: key })}
                  className={`h-10 rounded border text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${banner.position === key ? 'border-route bg-route text-white' : 'border-paper-line hover:bg-route-soft dark:border-night-line dark:hover:bg-route-softDark'}`}>
                  {banner.position === key ? '●' : ''}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-3">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-ink-soft dark:text-paper/60">Alineación del texto</legend>
              <div role="radiogroup" aria-label="Alineación del texto" className="inline-flex gap-1">
                {ALIGNS.map(([key, label, Icon]) => (
                  <button key={key} type="button" role="radio" aria-checked={banner.textAlign === key} aria-label={label} title={label} data-align={key}
                    onClick={() => set({ textAlign: key })}
                    className={`flex h-9 w-9 items-center justify-center rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${banner.textAlign === key ? 'border-route bg-route text-white' : 'border-paper-line hover:bg-route-soft dark:border-night-line dark:hover:bg-route-softDark'}`}>
                    <Icon size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-ink-soft dark:text-paper/60">Color del texto</legend>
              <div role="radiogroup" aria-label="Color del texto" className="inline-flex gap-1">
                {[['light', 'Claro'], ['dark', 'Oscuro']].map(([key, label]) => (
                  <button key={key} type="button" role="radio" aria-checked={banner.textColor === key} onClick={() => set({ textColor: key })}
                    className={`rounded border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${banner.textColor === key ? 'border-route bg-route text-white' : 'border-paper-line dark:border-night-line'}`}>{label}</button>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-medium text-ink-soft dark:text-paper/60">
              Oscurecer imagen: <output className="font-semibold text-ink dark:text-paper">{banner.overlay}%</output>
              <input type="range" min="0" max="80" step="5" value={banner.overlay} onChange={(e) => set({ overlay: Number(e.target.value) })} className="mt-1 block w-full" aria-label="Opacidad de la capa de oscurecimiento" />
              <span className="font-normal text-[11px]">Con texto oscuro, déjalo en 0 %.</span>
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inicio (opcional)"><input type="datetime-local" className="input-tr h-9 py-0" value={toLocalInput(banner.startsAt)} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} /></Field>
          <Field label="Fin (opcional)"><input type="datetime-local" className="input-tr h-9 py-0" value={toLocalInput(banner.endsAt)} onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })} /></Field>
        </div>

        <details className="rounded-xl2 border border-paper-line p-3 text-sm dark:border-night-line">
          <summary className="cursor-pointer text-xs font-semibold text-ink dark:text-paper">Ubicación avanzada (banners intercalados del Home)</summary>
          <p className="mt-2 text-[11px] text-ink-soft dark:text-paper/60">«Hero» va en el carrusel principal. «Intercalado» se usará en el compositor del Home (Cambio 5) según su ancho y posición.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field label="Ubicación"><select className="input-tr h-9 py-0" value={banner.placement} onChange={(e) => set({ placement: e.target.value })}><option value="hero">Hero (carrusel)</option><option value="inline">Intercalado</option></select></Field>
            <Field label="Ancho"><select className="input-tr h-9 py-0" value={banner.width} onChange={(e) => set({ width: e.target.value })}><option value="full">Completo</option><option value="half">Mitad (2 columnas)</option></select></Field>
            <Field label="Posición en el Home (slot)"><input className="input-tr h-9 py-0 font-mono text-xs" value={banner.slot} maxLength={40} onChange={(e) => set({ slot: e.target.value })} placeholder="ej. despues-de-ofertas" /></Field>
          </div>
        </details>

        <Check label="Activo" checked={banner.active} onChange={(v) => set({ active: v })} />
        {issues.length > 0 && (
          <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-signal-red">{issues.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-ink dark:text-paper">Vista previa en vivo</h4>
          <div role="radiogroup" aria-label="Tamaño de la vista previa" className="inline-flex gap-1">
            {[['desktop', 'Escritorio'], ['mobile', 'Móvil']].map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMode(key)}
                className={`rounded border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${mode === key ? 'border-route bg-route text-white' : 'border-paper-line dark:border-night-line'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div data-testid="preview" className={`overflow-hidden rounded-lg border border-paper-line dark:border-night-line ${mode === 'mobile' ? 'mx-auto max-w-[320px]' : ''}`}>
          {mode === 'desktop' ? (
            <ScaledPreview baseW={1440} baseH={450}><HeroSlide slide={banner} preview size="desktop" /></ScaledPreview>
          ) : (
            <ScaledPreview baseW={390} baseH={420}><HeroSlide slide={banner} preview size="mobile" /></ScaledPreview>
          )}
        </div>
        <p className="mt-2 text-[11px] text-ink-soft dark:text-paper/60">Así se ve el slide en {mode === 'desktop' ? 'una pantalla de escritorio (altura proporcional 1920×600)' : 'un móvil (390 px de ancho, 420 px de alto)'}. Los botones no navegan en la vista previa.</p>
      </div>
    </div>
  )
}

export default function AdminBanners() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [saved, setSaved] = useState([])
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const s = await api.admin.getSiteSettings(token)
      const list = Array.isArray(s.homeBanners) ? s.homeBanners : []
      setSaved(list)
      setBanners(list)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])
  useEffect(() => { load() }, [load])

  const dirty = JSON.stringify(saved) !== JSON.stringify(banners)
  const invalidCount = useMemo(() => banners.filter((b) => problems(b).length > 0).length, [banners])
  const replace = (b) => setBanners((l) => l.map((x) => (x.id === b.id ? b : x)))
  const move = (i, dir) => setBanners((l) => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = l.slice(); [n[i], n[j]] = [n[j], n[i]]; return n })
  const add = () => { const b = newBanner(); setBanners((l) => [...l, b]); setOpenId(b.id) }

  const save = async () => {
    setSaving(true)
    try {
      const payload = banners.map((b) => ({ ...b, title: b.title.trim(), description: b.description.trim(), eyebrow: b.eyebrow.trim(), buttons: b.buttons.map((x) => ({ ...x, label: x.label.trim(), href: x.href.trim() })) }))
      const res = await api.admin.saveSiteSetting('homeBanners', payload, token)
      setSaved(res.homeBanners)
      setBanners(res.homeBanners)
      invalidate('site-settings')
      toast?.showToast('Banners guardados.', 'success')
    } catch (e) {
      toast?.showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const status = (b) => {
    const now = new Date()
    if (!b.active) return ['Inactivo', 'bg-gray-200 text-ink-soft dark:bg-white/10 dark:text-paper/60']
    if (b.startsAt && new Date(b.startsAt) > now) return ['Programado', 'bg-signal-amber/15 text-signal-amber']
    if (b.endsAt && new Date(b.endsAt) <= now) return ['Vencido', 'bg-signal-red/10 text-signal-red']
    return ['Activo', 'bg-signal-green/15 text-signal-green']
  }

  return (
    <section aria-labelledby="banners-title">
      <SectionHeader id="banners-title" title="Banners del Home" description="Slides del carrusel principal de la Home (y banners intercalados, en el Cambio 5). Sin slides vigentes se muestra el hero genérico de TecRuta. El intervalo y el autoplay se cambian en Ajustes del sitio.">
        <div className="flex gap-2">
          <button type="button" onClick={add} disabled={banners.length >= 30} className="btn-secondary px-4 py-2 text-xs"><Plus size={14} className="mr-1 inline" />Agregar slide</button>
          <button type="button" onClick={save} disabled={!dirty || invalidCount > 0 || saving} className="btn-primary px-4 py-2 text-xs">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </SectionHeader>
      {dirty && <p role="status" className="mb-3 text-xs text-signal-amber">Tienes cambios sin guardar{invalidCount > 0 ? ` · ${invalidCount} slide(s) con datos por corregir` : ''}.</p>}
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && <p role="alert" className="text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!loading && !error && banners.length === 0 && <EmptyRow>No hay slides. Agrega el primero.</EmptyRow>}

      <ul className="space-y-3">
        {banners.map((b, i) => {
          const open = openId === b.id
          const [label, cls] = status(b)
          const bad = problems(b).length > 0
          return (
            <li key={b.id} className={`rounded-xl2 border p-3 ${bad ? 'border-signal-red/50' : 'border-paper-line dark:border-night-line'}`}>
              <div className="flex flex-wrap items-center gap-3">
                {b.imageDesktop ? <img src={b.imageDesktop} alt="" className="h-10 w-20 rounded object-cover" /> : <span className="flex h-10 w-20 items-center justify-center rounded bg-route-soft text-[10px] text-route dark:bg-route-softDark">Sin imagen</span>}
                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-sm font-semibold text-ink dark:text-paper">{b.title || '(sin título)'}</p>
                  <p className="text-[11px] text-ink-soft dark:text-paper/60">{b.placement === 'hero' ? 'Hero' : `Intercalado · ${b.width === 'half' ? 'mitad' : 'completo'}`}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
                <Check label="Activo" checked={b.active} onChange={(v) => replace({ ...b, active: v })} />
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowUp size={16} /></button>
                <button type="button" aria-label="Bajar" disabled={i === banners.length - 1} onClick={() => move(i, 1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowDown size={16} /></button>
                <button type="button" aria-expanded={open} aria-controls={`editor-${b.id}`} onClick={() => setOpenId(open ? null : b.id)} className="btn-secondary px-3 py-1.5 text-xs">
                  {open ? <ChevronUp size={14} className="mr-1 inline" /> : <ChevronDown size={14} className="mr-1 inline" />}{open ? 'Cerrar' : 'Editar'}
                </button>
                <button type="button" aria-label={`Eliminar slide ${b.title || ''}`} onClick={() => window.confirm('¿Eliminar este slide?') && setBanners((l) => l.filter((x) => x.id !== b.id))} className="btn-ghost p-2 text-signal-red"><Trash2 size={16} /></button>
              </div>
              {open && <div id={`editor-${b.id}`}><Editor banner={b} onChange={replace} token={token} /></div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}