import React, { useContext, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'

function CategoryRow({ category, token, onSaved }) {
  const toast = useContext(ToastContext)
  const [draft, setDraft] = useState({ name: category.name, description: category.description || '' })
  const [saving, setSaving] = useState(false)

  const dirty = draft.name !== category.name || draft.description !== (category.description || '')

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.admin.updateCategory(category.slug, draft, token)
      onSaved(updated)
      toast?.showToast(`"${updated.name}" actualizada.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-paper-line last:border-0 dark:border-night-line">
      <td className="py-2.5 pr-3 text-xs text-ink-soft dark:text-paper/50">{category.slug}</td>
      <td className="py-2.5 pr-3">
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="input-tr h-9 py-0 text-sm"
        />
      </td>
      <td className="py-2.5 pr-3">
        <input
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Descripción"
          className="input-tr h-9 py-0 text-sm"
        />
      </td>
      <td className="py-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-route transition-colors hover:bg-route-soft disabled:opacity-30 dark:hover:bg-route-softDark"
          aria-label="Guardar cambios"
        >
          <Save className="h-4 w-4" />
        </button>
      </td>
    </tr>
  )
}

export default function AdminCategories() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCategory, setNewCategory] = useState({ slug: '', name: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api
      .getCategories()
      .then(setCategories)
      .catch((err) => toast?.showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleSaved = (updated) => {
    setCategories((list) => list.map((c) => (c.slug === updated.slug ? updated : c)))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newCategory.slug.trim() || !newCategory.name.trim()) {
      toast?.showToast('Completa al menos el slug y el nombre.', 'error')
      return
    }
    setCreating(true)
    try {
      const created = await api.admin.createCategory(newCategory, token)
      setCategories((list) => [...list, created])
      setNewCategory({ slug: '', name: '', description: '' })
      setShowCreate(false)
      toast?.showToast('Categoría creada.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-soft dark:text-paper/60">Cargando categorías…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft dark:text-paper/60">{categories.length} categorías</p>
        <button type="button" onClick={() => setShowCreate((v) => !v)} className="btn-secondary">
          {showCreate ? 'Cancelar' : '+ Nueva categoría'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-xl2 border border-paper-line p-4 dark:border-night-line sm:grid-cols-3">
          <input
            className="input-tr"
            placeholder="slug (ej: monitores)"
            value={newCategory.slug}
            onChange={(e) => setNewCategory((n) => ({ ...n, slug: e.target.value }))}
          />
          <input
            className="input-tr"
            placeholder="Nombre"
            value={newCategory.name}
            onChange={(e) => setNewCategory((n) => ({ ...n, name: e.target.value }))}
          />
          <input
            className="input-tr"
            placeholder="Descripción (opcional)"
            value={newCategory.description}
            onChange={(e) => setNewCategory((n) => ({ ...n, description: e.target.value }))}
          />
          <button type="submit" disabled={creating} className="btn-primary sm:col-span-3">
            {creating ? 'Creando…' : 'Crear categoría'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl2 border border-paper-line dark:border-night-line">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-paper-line bg-paper text-xs uppercase tracking-wide text-ink-soft dark:border-night-line dark:bg-night dark:text-paper/50">
              <th className="px-3 py-2.5 font-medium">Slug</th>
              <th className="px-3 py-2.5 font-medium">Nombre</th>
              <th className="px-3 py-2.5 font-medium">Descripción</th>
              <th className="px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="px-3">
            {categories.map((category) => (
              <CategoryRow key={category.slug} category={category} token={token} onSaved={handleSaved} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-soft/70 dark:text-paper/40">
        Nota: la navegación de la web (menú, filtros) todavía toma las categorías del archivo estático{' '}
        <code>categories.js</code>, no de aquí. Editar/crear categorías desde este panel actualiza la base de datos —
        conectar la navegación pública a esto queda pendiente para más adelante.
      </p>
    </div>
  )
}