import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, Save, Pencil, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { useWorkspacePreference, useWorkspaceScroll } from '../../hooks/useWorkspaceMemory.js'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { STORE_ORIGIN } from '../../app/urls.js'
import ProductForm, { productToFormValues } from './ProductForm.jsx'

const PRODUCTS_PER_PAGE = 25

function ProductPagination({ page, pages, total, onChange, position }) {
  if (total <= PRODUCTS_PER_PAGE) return null
  return <nav aria-label={`Páginas de productos (${position})`} className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-ink-soft dark:text-paper/70">25 productos por página</p>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
      <label className="flex items-center gap-2 text-sm" htmlFor={`products-page-${position}`}>Página
        <select id={`products-page-${position}`} className="input-tr w-20" value={page} onChange={event => onChange(Number(event.target.value))}>
          {Array.from({ length: pages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
        </select>
        <span>de {pages}</span>
      </label>
      <button type="button" className="btn-secondary disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</button>
    </div>
  </nav>
}

function ProductRow({ product, categories, token, onSaved, onDeleted }) {
  const toast = useContext(ToastContext)
  const [draft, setDraft] = useState({
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? '',
    stock: product.stock,
    stockReason: '',
    featured: product.featured,
    bestSeller: product.bestSeller,
    category: product.category,
  })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [savingFull, setSavingFull] = useState(false)

  // Sincroniza los campos cuando el producto cambia (guardado rápido,
  // recarga tras un 409 o actualización desde otra pestaña).
  useEffect(() => {
    setDraft({
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? '',
      stock: product.stock,
      stockReason: '',
      featured: product.featured,
      bestSeller: product.bestSeller,
      category: product.category,
    })
  }, [product])

  const dirty =
    Number(draft.price) !== product.price ||
    (draft.compareAtPrice === '' ? null : Number(draft.compareAtPrice)) !== product.compareAtPrice ||
    Number(draft.stock) !== product.stock ||
    draft.featured !== product.featured ||
    draft.bestSeller !== product.bestSeller ||
    draft.category !== product.category
  const stockChanged = Number(draft.stock) !== product.stock

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
          ...(stockChanged ? { stock: Number(draft.stock), expectedStock: product.stock } : {}),
          stockReason: draft.stockReason.trim() || null,
          featured: draft.featured,
          bestSeller: draft.bestSeller,
          category: draft.category,
        },
        token,
      )
      onSaved(updated)
      toast?.showToast(`"${product.name}" actualizado.`, 'success')
    } catch (err) {
      // Stock obsoleto: otro usuario (POS, inventario) cambió el saldo
      // después de cargar la lista. Recarga los valores actuales para que
      // la fila no quede mostrando números viejos.
      if (err.status === 409 && err.message.includes('stock cambió')) {
        try {
          const fresh = await api.getProductBySlug(product.slug)
          onSaved(fresh)
          toast?.showToast('El stock cambió en otro lugar. Se recargaron los valores actuales: revisa y vuelve a guardar.', 'error')
        } catch {
          toast?.showToast(err.message, 'error')
        }
      } else {
        toast?.showToast(err.message, 'error')
      }
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
      if (err.status === 409 && err.message.includes('stock cambió')) {
        try {
          const fresh = await api.getProductBySlug(product.slug)
          onSaved(fresh)
          toast?.showToast('El stock cambió en otro lugar. Se recargaron los valores actuales: revisa y vuelve a guardar.', 'error')
        } catch {
          toast?.showToast(err.message, 'error')
        }
      } else {
        toast?.showToast(err.message, 'error')
      }
    } finally {
      setSavingFull(false)
    }
  }

  return (
    <>
      <tr data-unsaved={dirty || expanded ? 'true' : undefined} className="border-b border-paper-line last:border-0 dark:border-night-line">
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-2.5">
            <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink dark:text-paper">{product.name}</p>
              <p className="truncate font-mono text-xs text-ink-soft dark:text-paper/50">{product.slug}{product.sku ? ` · ${product.sku}` : ''}</p>
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
          <input
            type="text"
            value={draft.stockReason}
            onChange={set('stockReason')}
            placeholder="Motivo"
            aria-label={`Motivo del cambio de stock de ${product.name}`}
            className="input-tr mt-1 h-8 w-28 py-0 text-xs"
            maxLength={240}
          />
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
              disabled={!dirty || saving || (stockChanged && !draft.stockReason.trim())}
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
            <a
              href={`${STORE_ORIGIN}/producto/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
              aria-label={`Ver ${product.name} en la tienda`}
              title="Ver en la tienda"
            >
              <Eye className="h-4 w-4" />
            </a>
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
  const [search, setSearch] = useWorkspacePreference('products-search', new URLSearchParams(location.search).get('buscar') || '')
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get('buscar'); if (requested !== null) setSearch(requested) }, [])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)
  const listRef = useRef(null)
  const summaryRef = useRef(null)
  useWorkspaceScroll(!loading)

  useEffect(() => {
    // Categorías: TODO el árbol (nuevas + heredadas) con la ruta completa en la
    // etiqueta, para poder reasignar sin perder la categoría actual.
    const withPaths = (rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]))
      const label = (r) => (r.parentId && byId.get(r.parentId) ? `${label(byId.get(r.parentId))} › ${r.name}` : r.name)
      return rows.map((r) => ({ slug: r.slug, name: r.legacy ? `${r.name} (heredada)` : label(r) })).sort((a, b) => a.name.localeCompare(b.name))
    }
    Promise.all([api.getProducts(), api.admin.getCategoryTree(token).then(withPaths)])
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
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
  }, [products, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE))
  const currentPage = Math.min(page, pages)
  const start = (currentPage - 1) * PRODUCTS_PER_PAGE
  const visibleProducts = filtered.slice(start, start + PRODUCTS_PER_PAGE)
  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  const changePage = next => {
    if (next === currentPage) return
    if (listRef.current?.querySelector('[data-unsaved="true"]') && !window.confirm('Hay cambios sin guardar o un editor abierto. Al cambiar de página se descartarán sus cambios pendientes. ¿Continuar?')) return
    setPage(next)
    window.requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ block: 'center' })
      summaryRef.current?.focus({ preventScroll: true })
    })
  }

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
      setPage(1)
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
          aria-label="Buscar productos por nombre o slug en todo el catálogo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, slug o SKU…"
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

      <p ref={summaryRef} tabIndex={-1} role="status" className="rounded text-sm text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route dark:text-paper/70">
        {filtered.length ? `Mostrando ${start + 1}–${Math.min(start + PRODUCTS_PER_PAGE, filtered.length)} de ${filtered.length} productos` : '0 productos'}
      </p>
      <ProductPagination page={currentPage} pages={pages} total={filtered.length} onChange={changePage} position="superior" />
      <div ref={listRef} className="overflow-x-auto rounded-xl2 border border-paper-line dark:border-night-line">
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
            {visibleProducts.map((product) => (
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
      <ProductPagination page={currentPage} pages={pages} total={filtered.length} onChange={changePage} position="inferior" />
      {filtered.length === 0 && <p className="text-sm text-ink-soft dark:text-paper/60">No hay productos que coincidan con la búsqueda.</p>}
      <p className="text-xs text-ink-soft/70 dark:text-paper/40">
        Precio, "antes de", stock, destacado y best seller: cambia el valor y presiona <Save className="inline h-3 w-3" /> para
        guardar solo esa fila. Usa <Pencil className="inline h-3 w-3" /> para editar imágenes, descripción, tags y
        especificaciones completas.
      </p>
    </div>
  )
}
