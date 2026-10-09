import React, { useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, Field, SectionHeader } from '../../components/admin/adminUi.jsx'

const DEFAULT_PROMO = { label: '', href: '/catalogo', visible: true }
// Mismos valores/orden que el pie de /carrito (los íconos van fijos por posición).
export const DEFAULT_CART_FOOTER = [
  { label: 'Visita nuestro Centro de Apoyo', href: '/ayuda' },
  { label: 'Consulta el estado de tu pedido', href: '/mis-pedidos' },
  { label: 'Envío, entrega y recogida en tienda', href: '/proximamente' },
  { label: 'Devoluciones e intercambios', href: '/proximamente' },
  { label: 'Garantía de igualación de precio', href: '/proximamente' },
]
const validHref = (h) => /^(\/|https?:\/\/)/.test(h)

export default function AdminSiteSettings() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [saved, setSaved] = useState(null)
  const [promo, setPromo] = useState(DEFAULT_PROMO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [footerSaved, setFooterSaved] = useState(DEFAULT_CART_FOOTER)
  const [footer, setFooter] = useState(DEFAULT_CART_FOOTER)
  const [savingFooter, setSavingFooter] = useState(false)
  const DEFAULT_CAROUSEL = { intervalSeconds: 6, autoplay: true }
  const [carouselSaved, setCarouselSaved] = useState(DEFAULT_CAROUSEL)
  const [carousel, setCarousel] = useState(DEFAULT_CAROUSEL)
  const [savingCarousel, setSavingCarousel] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = await api.admin.getSiteSettings(token)
      const value = { ...DEFAULT_PROMO, ...(settings.seasonalPromo || {}) }
      setSaved(value)
      setPromo(value)
      const f = Array.isArray(settings.cartFooterLinks) && settings.cartFooterLinks.length === 5 ? settings.cartFooterLinks : DEFAULT_CART_FOOTER
      setFooterSaved(f)
      setFooter(f)
      const c = settings.heroCarousel && typeof settings.heroCarousel === 'object' ? { intervalSeconds: 6, autoplay: true, ...settings.heroCarousel } : { intervalSeconds: 6, autoplay: true }
      setCarouselSaved(c)
      setCarousel(c)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const dirty = saved && JSON.stringify(saved) !== JSON.stringify(promo)
  const hrefOk = /^(\/|https?:\/\/)/.test(promo.href)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.admin.saveSiteSetting('seasonalPromo', { label: promo.label.trim(), href: promo.href.trim(), visible: promo.visible }, token)
      setSaved(res.seasonalPromo)
      setPromo(res.seasonalPromo)
      invalidate('nav')
      invalidate('site-settings')
      toast?.showToast('Promo de temporada guardada.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const secondsOk = Number.isInteger(carousel.intervalSeconds) && carousel.intervalSeconds >= 3 && carousel.intervalSeconds <= 30
  const carouselDirty = JSON.stringify(carouselSaved) !== JSON.stringify(carousel)
  const saveCarousel = async (e) => {
    e.preventDefault()
    setSavingCarousel(true)
    try {
      const res = await api.admin.saveSiteSetting('heroCarousel', { intervalSeconds: carousel.intervalSeconds, autoplay: carousel.autoplay }, token)
      setCarouselSaved(res.heroCarousel)
      setCarousel(res.heroCarousel)
      invalidate('site-settings')
      toast?.showToast('Ajustes del carrusel guardados.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSavingCarousel(false)
    }
  }

  const footerDirty = JSON.stringify(footerSaved) !== JSON.stringify(footer)
  const footerOk = footer.every((l) => l.label.trim() && validHref(l.href))
  const saveFooter = async (e) => {
    e.preventDefault()
    setSavingFooter(true)
    try {
      const res = await api.admin.saveSiteSetting('cartFooterLinks', footer.map((l) => ({ label: l.label.trim(), href: l.href.trim() })), token)
      setFooterSaved(res.cartFooterLinks)
      setFooter(res.cartFooterLinks)
      invalidate('site-settings')
      toast?.showToast('Enlaces del carrito guardados.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSavingFooter(false)
    }
  }

  return (
    <section aria-labelledby="settings-title">
      <SectionHeader id="settings-title" title="Ajustes del sitio" description="Textos que se editan en un solo lugar y se reflejan en toda la tienda." />
      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-signal-red">
          {error} <button type="button" onClick={load} className="underline">Reintentar</button>
        </p>
      )}
      {!loading && !error && (
        <form onSubmit={save} className="max-w-xl rounded-xl2 border border-paper-line p-4 dark:border-night-line">
          <h3 className="mb-1 font-semibold text-ink dark:text-paper">Promo de temporada</h3>
          <p className="mb-3 text-xs text-ink-soft dark:text-paper/60">
            Aparece en la fila 2 del header y en el menú «Descubre». Ocultarla la quita de ambos sitios.
          </p>
          <div className="grid gap-3">
            <Field label="Texto">
              <input className="input-tr" value={promo.label} onChange={(e) => setPromo({ ...promo, label: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Enlace (ej. /catalogo o https://…)">
              <input className="input-tr" value={promo.href} onChange={(e) => setPromo({ ...promo, href: e.target.value })} aria-invalid={!hrefOk} />
              {!hrefOk && <span className="text-signal-red">Debe empezar con «/» o «https://».</span>}
            </Field>
            <Check label="Visible" checked={promo.visible} onChange={(v) => setPromo({ ...promo, visible: v })} />
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={!dirty || saving || !promo.label.trim() || !hrefOk}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
      {!loading && !error && (
        <form onSubmit={saveCarousel} className="mt-6 max-w-xl rounded-xl2 border border-paper-line p-4 dark:border-night-line">
          <h3 className="mb-1 font-semibold text-ink dark:text-paper">Carrusel del Home</h3>
          <p className="mb-3 text-xs text-ink-soft dark:text-paper/60">Ajustes globales del hero. Los slides se editan en «Banners del Home». Con «reducir movimiento» activado en el dispositivo del visitante, nunca rota solo.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Segundos entre slides (3 a 30)">
              <input type="number" min="3" max="30" step="1" className="input-tr h-9 py-0" value={carousel.intervalSeconds} aria-invalid={!secondsOk}
                onChange={(e) => setCarousel({ ...carousel, intervalSeconds: e.target.value === '' ? NaN : Number(e.target.value) })} />
              {!secondsOk && <span className="text-signal-red">Debe ser un número entero entre 3 y 30.</span>}
            </Field>
            <div className="flex items-end pb-2"><Check label="Rotación automática (autoplay)" checked={carousel.autoplay} onChange={(v) => setCarousel({ ...carousel, autoplay: v })} /></div>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={!carouselDirty || !secondsOk || savingCarousel}>{savingCarousel ? 'Guardando…' : 'Guardar carrusel'}</button>
        </form>
      )}
      {!loading && !error && (
        <form onSubmit={saveFooter} className="mt-6 max-w-xl rounded-xl2 border border-paper-line p-4 dark:border-night-line">
          <h3 className="mb-1 font-semibold text-ink dark:text-paper">Enlaces del pie del carrito</h3>
          <p className="mb-3 text-xs text-ink-soft dark:text-paper/60">Los 5 accesos de ayuda al final de /carrito (el ícono de cada uno es fijo).</p>
          <ul className="grid gap-3">
            {footer.map((l, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-2">
                <Field label={`Texto ${i + 1}`}><input className="input-tr h-9 py-0" value={l.label} maxLength={80} onChange={(e) => setFooter((f) => f.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} /></Field>
                <Field label={`Enlace ${i + 1}`}>
                  <input className="input-tr h-9 py-0 font-mono text-xs" value={l.href} aria-invalid={!validHref(l.href)} onChange={(e) => setFooter((f) => f.map((x, k) => (k === i ? { ...x, href: e.target.value } : x)))} />
                </Field>
              </li>
            ))}
          </ul>
          <button type="submit" className="btn-primary mt-4" disabled={!footerDirty || !footerOk || savingFooter}>{savingFooter ? 'Guardando…' : 'Guardar enlaces'}</button>
        </form>
      )}
    </section>
  )
}