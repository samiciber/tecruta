import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { invalidate } from '../../hooks/useCachedResource.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { Check, EmptyRow, Field, SectionHeader, readFileAsDataUrl } from '../../components/admin/adminUi.jsx'

function BrandRow({ brand, token, onChanged, onDeleted }) {
  const toast = useContext(ToastContext)
  const [draft, setDraft] = useState(brand)
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(brand), [brand])

  const dirty = ['name', 'slug', 'logo', 'featured', 'featuredPosition', 'visible'].some((k) => (draft[k] ?? '') !== (brand[k] ?? ''))
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const save = async () => {
    setBusy(true)
    try {
      const updated = await api.admin.updateBrand(
        brand.id,
        {
          name: draft.name,
          slug: draft.slug,
          logo: draft.logo || null,
          featured: draft.featured,
          featuredPosition: Number(draft.featuredPosition) || 0,
          visible: draft.visible,
        },
        token,
      )
      onChanged({ ...brand, ...updated, productCount: brand.productCount })
      invalidate('brands')
      toast?.showToast(`"${updated.name}" guardada.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`¿Eliminar la marca "${brand.name}"?`)) return
    try {
      await api.admin.deleteBrand(brand.id, token)
      onDeleted(brand.id)
      invalidate('brands')
      toast?.showToast('Marca eliminada.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    }
  }

  const upload = async (file) => {
    if (!file) return
    try {
      const { url } = await api.admin.uploadImage(await readFileAsDataUrl(file), token)
      set({ logo: url })
      toast?.showToast('Logo subido. Guarda para aplicarlo.', 'info')
    } catch (err) {
      toast?.showToast(`No se pudo subir el logo: ${err.message}`, 'error')
    }
  }

  return (
    <li className="rounded-xl2 border border-paper-line p-3 dark:border-night-line">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.2fr_80px_auto]">
        <Field label="Nombre">
          <input className="input-tr h-9 py-0" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Slug (URL /marca/…)">
          <input className="input-tr h-9 py-0 font-mono text-xs" value={draft.slug} onChange={(e) => set({ slug: e.target.value })} />
        </Field>
        <Field label="Orden dest.">
          <input
            type="number"
            min="0"
            className="input-tr h-9 py-0"
            value={draft.featuredPosition}
            disabled={!draft.featured}
            onChange={(e) => set({ featuredPosition: e.target.value })}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-1">
          <Check label="Destacada" checked={draft.featured} onChange={(v) => set({ featured: v })} />
          <Check label="Visible" checked={draft.visible} onChange={(v) => set({ visible: v })} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {draft.logo ? <img src={draft.logo} alt="" className="h-9 w-16 rounded border border-paper-line object-contain dark:border-night-line" /> : null}
        <Field label="Logo (URL o subir)" className="min-w-[200px] flex-1">
          <input className="input-tr h-9 py-0" value={draft.logo ?? ''} onChange={(e) => set({ logo: e.target.value })} placeholder="https://…" />
        </Field>
        <label className="btn-secondary mt-4 cursor-pointer px-4 py-2 text-xs">
          Subir
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        <span className="mt-4 text-xs text-ink-soft dark:text-paper/50">{brand.productCount ?? 0} producto(s)</span>
        <div className="mt-4 ml-auto flex gap-2">
          <button type="button" onClick={save} disabled={!dirty || busy} className="btn-primary px-4 py-2 text-xs">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={remove} className="btn-secondary px-4 py-2 text-xs text-signal-red">
            Eliminar
          </button>
        </div>
      </div>
    </li>
  )
}

export default function AdminBrands() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setBrands(await api.admin.getBrands(token))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const visibleList = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return brands
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.slug.includes(q))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || (a.featured ? a.featuredPosition - b.featuredPosition : 0) || a.name.localeCompare(b.name))
  }, [brands, filter])

  const create = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await api.admin.createBrand({ name: newName.trim() }, token)
      setBrands((list) => [{ ...created, productCount: 0 }, ...list])
      setNewName('')
      invalidate('brands')
      toast?.showToast(`"${created.name}" creada.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section aria-labelledby="brands-title">
      <SectionHeader
        id="brands-title"
        title="Marcas"
        description="Las marcas destacadas aparecen en «Comprar por marca» (en el orden indicado); todas las visibles aparecen en /marcas, agrupadas A–Z."
      />
      <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Nueva marca" className="min-w-[220px] flex-1">
          <input className="input-tr" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la marca" maxLength={120} />
        </Field>
        <button type="submit" className="btn-primary" disabled={creating || !newName.trim()}>
          {creating ? 'Creando…' : 'Agregar marca'}
        </button>
        <Field label="Buscar" className="min-w-[180px]">
          <input className="input-tr" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar…" />
        </Field>
      </form>

      {loading && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando marcas…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-signal-red">
          {error} <button type="button" onClick={load} className="underline">Reintentar</button>
        </p>
      )}
      {!loading && !error && visibleList.length === 0 && <EmptyRow>No hay marcas que coincidan.</EmptyRow>}
      <ul className="space-y-3">
        {visibleList.map((b) => (
          <BrandRow
            key={b.id}
            brand={b}
            token={token}
            onChanged={(u) => setBrands((list) => list.map((x) => (x.id === u.id ? u : x)))}
            onDeleted={(id) => setBrands((list) => list.filter((x) => x.id !== id))}
          />
        ))}
      </ul>
    </section>
  )
}