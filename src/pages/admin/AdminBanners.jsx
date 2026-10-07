import React, { useCallback, useContext, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader, readFileAsDataUrl } from '../../components/admin/adminUi.jsx'

const newBanner = () => ({ id: `b${Date.now().toString(36)}`, eyebrow: '', title: '', subtitle: '', ctaLabel: 'Ver más', href: '/catalogo', image: null, active: true })
const validHref = (h) => /^(\/|https?:\/\/)/.test(h)

export default function AdminBanners() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [saved, setSaved] = useState([])
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const s = await api.admin.getSiteSettings(token)
      const list = Array.isArray(s.homeBanners) ? s.homeBanners : []
      setSaved(list)
      setBanners(list)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [token])
  useEffect(() => { load() }, [load])

  const dirty = JSON.stringify(saved) !== JSON.stringify(banners)
  const invalid = banners.some((b) => !b.title.trim() || !validHref(b.href))
  const patch = (id, data) => setBanners((l) => l.map((b) => (b.id === id ? { ...b, ...data } : b)))
  const move = (i, dir) => setBanners((l) => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = l.slice(); [n[i], n[j]] = [n[j], n[i]]; return n })

  const upload = async (id, file) => {
    if (!file) return
    try {
      const { url } = await api.admin.uploadImage(await readFileAsDataUrl(file), token)
      patch(id, { image: url })
    } catch (e) { toast?.showToast(`No se pudo subir la imagen: ${e.message}`, 'error') }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.admin.saveSiteSetting('homeBanners', banners.map((b) => ({ ...b, title: b.title.trim(), href: b.href.trim(), image: b.image || null })), token)
      setSaved(res.homeBanners)
      setBanners(res.homeBanners)
      invalidate('site-settings')
      toast?.showToast('Banners guardados.', 'success')
    } catch (e) { toast?.showToast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <section aria-labelledby="banners-title">
      <SectionHeader id="banners-title" title="Banners del Home" description="El carrusel principal de la Home. Sin banners activos se usan las categorías con imagen (o un banner genérico de TecRuta). Recomendado: imagen horizontal de 1920×760.">
        <div className="flex gap-2">
          <button type="button" onClick={() => setBanners((l) => [...l, newBanner()])} disabled={banners.length >= 10} className="btn-secondary px-4 py-2 text-xs"><Plus size={14} className="mr-1 inline" />Agregar banner</button>
          <button type="button" onClick={save} disabled={!dirty || invalid || saving} className="btn-primary px-4 py-2 text-xs">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </SectionHeader>
      {dirty && <p role="status" className="mb-3 text-xs text-signal-amber">Tienes cambios sin guardar.</p>}
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && <p role="alert" className="text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!loading && !error && banners.length === 0 && <EmptyRow>No hay banners. Agrega el primero.</EmptyRow>}
      <ul className="space-y-4">
        {banners.map((b, i) => (
          <li key={b.id} className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Título *"><input className="input-tr h-9 py-0" value={b.title} onChange={(e) => patch(b.id, { title: e.target.value })} maxLength={80} aria-invalid={!b.title.trim()} /></Field>
              <Field label="Etiqueta superior"><input className="input-tr h-9 py-0" value={b.eyebrow} onChange={(e) => patch(b.id, { eyebrow: e.target.value })} maxLength={60} /></Field>
              <Field label="Subtítulo" className="sm:col-span-2"><input className="input-tr h-9 py-0" value={b.subtitle} onChange={(e) => patch(b.id, { subtitle: e.target.value })} maxLength={200} /></Field>
              <Field label="Texto del botón"><input className="input-tr h-9 py-0" value={b.ctaLabel} onChange={(e) => patch(b.id, { ctaLabel: e.target.value })} maxLength={40} /></Field>
              <Field label="Enlace * (/ruta o https://…)">
                <input className="input-tr h-9 py-0 font-mono text-xs" value={b.href} onChange={(e) => patch(b.id, { href: e.target.value })} aria-invalid={!validHref(b.href)} />
                {!validHref(b.href) && <span className="text-signal-red">Debe empezar con «/» o «https://».</span>}
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {b.image ? <img src={b.image} alt="" className="h-12 w-28 rounded object-cover" /> : <span className="flex h-12 w-28 items-center justify-center rounded bg-route-soft text-xs text-route dark:bg-route-softDark">Sin imagen</span>}
              <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">Subir imagen<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(b.id, e.target.files?.[0])} /></label>
              {b.image && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => patch(b.id, { image: null })}>Quitar imagen</button>}
              <Check label="Activo" checked={b.active} onChange={(v) => patch(b.id, { active: v })} />
              <div className="ml-auto flex gap-1">
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowUp size={16} /></button>
                <button type="button" aria-label="Bajar" disabled={i === banners.length - 1} onClick={() => move(i, 1)} className="btn-ghost p-2 disabled:opacity-30"><ArrowDown size={16} /></button>
                <button type="button" aria-label={`Eliminar banner ${b.title}`} onClick={() => window.confirm('¿Eliminar este banner?') && setBanners((l) => l.filter((x) => x.id !== b.id))} className="btn-ghost p-2 text-signal-red"><Trash2 size={16} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}