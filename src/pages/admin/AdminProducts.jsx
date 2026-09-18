import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Trash2, Save, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import ProductForm, { productToFormValues } from './ProductForm.jsx'

function ProductRow({ product, categories, token, onSaved, onDeleted }) {
  const toast = useContext(ToastContext)
  const [draft, setDraft] = useState({
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? '',
    stock: product.stock,
    featured: product.featured,
    bestSeller: product.bestSeller,
    category: product.category,
  })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [savingFull, setSavingFull] = useState(false)

  const dirty =
    Number(draft.price) !== product.price ||
    (draft.compareAtPrice === '' ? null : Number(draft.compareAtPrice)) !== product.compareAtPrice ||
    Number(draft.stock) !== product.stock ||
    draft.featured !== product.featured ||
    draft.bestSeller !== product.bestSeller ||
    draft.category !== product.category

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setDraft((d) => ({ ...d, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.admin.updateProduct(
        product.id,
        {
          price: Number(draft.price),
          compareAtPrice: draft.compareAtPrice === '' ? null : Number(draft.compareAtPrice),
          stock: Number(draft.stock),
          featured: draft.featured,
          bestSeller: draft.bestSeller,
          category: draft.category,
        },
        token,
      )
      onSaved(updated)
      toast?.showToast(`"${product.name}" actualizado.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.admin.deleteProduct(product.id, token)
      onDeleted(product.id)
      toast?.showToast(`"${product.name}" eliminado.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    }
  }

  const handleFullSave = async (payload) => {
    setSavingFull(true)
    try {
      const updated = await api.admin.updateProduct(product.id, payload, token)
      onSaved(updated)
      setExpanded(false)
      toast?.showToast(`"${updated.name}" actualizado.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSavingFull(false)
    }
  }

  return (
    <>
      <tr className="border-b border-paper-line last:border-0 dark:border-night-line">
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-2.5">
            <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink dark:text-paper">{product.name}</p>
              <p className="truncate text-xs text-ink-soft dark:text-paper/50">{product.slug}</p>
            </div>
          </div>
        </td>
        <td className="py-2.5 pr-3">
          <select value={draft.category} onChange={set('category')} className="input-tr h-9 py-0 text-xs">
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2.5 pr-3">
          <input type="number" step="0.01" value={draft.price} onChange={set('price')} className="input-tr h-9 w-24 py-0 text-xs" />
        </td>
        <td className="py-2.5 pr-3">
          <input
            type="number"
            step="0.01"
            value={draft.compareAtPrice}
            onChange={set('compareAtPrice')}
            placeholder="—"
            className="input-tr h-9 w-24 py-0 text-xs"
          />
        </td>
        <td className="py-2.5 pr-3">
          <input type="number" value={draft.stock} onChange={set('stock')} className="input-tr h-9 w-20 py-0 text-xs" />
        </td>
        <td className="py-2.5 pr-3 text-center">
          <input type="checkbox" checked={draft.featured} onChange={set('featured')} className="h-4 w-4 rounded border-paper-line text-route dark:border-night-line" />
        </td>
        <td className="py-2.5 pr-3 text-center">
          <input type="checkbox" checked={draft.bestSeller} onChange={set('bestSeller')} className="h-4 w-4 rounded border-paper-line text-route dark:border-night-line" />
        </td>
        <td className="py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-route transition-colors hover:bg-route-soft disabled:opacity-30 dark:hover:bg-route-softDark"
              aria-label="Guardar cambios rápidos"
              title="Guardar cambios rápidos"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
              aria-label={expanded ? 'Ocultar edición completa' : 'Editar todo (imágenes, descripción, tags, specs)'}
              title="Editar todo (imágenes, descripción, tags, specs)"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-signal-red transition-colors hover:bg-signal-red/10"
              aria-label="Eliminar producto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-paper-line last:border-0 dark:border-night-line">
          <td colSpan={8} className="bg-paper px-3 py-4 dark:bg-night">
            <ProductForm
              categories={categories}
              initialValues={productToFormValues(product)}
              submitting={savingFull}
              submitLabel="Guardar cambios"
              onCancel={() => setExpanded(false)}
              onSubmit={handleFullSave}
            />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminProducts() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([api.getProducts(), api.getCategories()])
      .then(([p, c]) => {
        setProducts(p)
        setCategories(c)
      })
      .catch((err) => toast?.showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
  }, [products, search])

  const handleSaved = (updated) => {
    setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)))
  }
  const handleDeleted = (id) => {
    setProducts((list) => list.filter((p) => p.id !== id))
  }

  const handleCreate = async (payload) => {
    setCreating(true)
    try {
      const created = await api.admin.createProduct(payload, token)
      setProducts((list) => [created, ...list])
      setShowCreate(false)
      toast?.showToast('Producto creado.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-soft dark:text-paper/60">Cargando productos…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o slug…"
          className="input-tr max-w-xs"
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-soft dark:text-paper/60">{filtered.length} productos</span>
          <button type="button" onClick={() => setShowCreate((v) => !v)} className="btn-secondary">
            {showCreate ? 'Cancelar' : '+ Nuevo producto'}
          </button>
        </div>
      </div>

      {showCreate && (
        <ProductForm
          categories={categories}
          submitting={creating}
          submitLabel="Crear producto"
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      <div className="overflow-x-auto rounded-xl2 border border-paper-line dark:border-night-line">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-paper-line bg-paper text-xs uppercase tracking-wide text-ink-soft dark:border-night-line dark:bg-night dark:text-paper/50">
              <th className="px-3 py-2.5 font-medium">Producto</th>
              <th className="px-3 py-2.5 font-medium">Categoría</th>
              <th className="px-3 py-2.5 font-medium">Precio</th>
              <th className="px-3 py-2.5 font-medium">Antes de</th>
              <th className="px-3 py-2.5 font-medium">Stock</th>
              <th className="px-3 py-2.5 font-medium">Destacado</th>
              <th className="px-3 py-2.5 font-medium">Best seller</th>
              <th className="px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="px-3">
            {filtered.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                categories={categories}
                token={token}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="text-sm text-ink-soft dark:text-paper/60">No hay productos que coincidan con la búsqueda.</p>}
      <p className="text-xs text-ink-soft/70 dark:text-paper/40">
        Precio, "antes de", stock, destacado y best seller: cambia el valor y presiona <Save className="inline h-3 w-3" /> para
        guardar solo esa fila. Usa <Pencil className="inline h-3 w-3" /> para editar imágenes, descripción, tags y
        especificaciones completas.
      </p>
    </div>
  )
}