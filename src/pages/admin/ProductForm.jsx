import React, { useContext, useId, useState } from 'react'
import { Plus, X, Upload, Loader2 } from 'lucide-react'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../services/api.js'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB — de sobra para una foto de producto
const MAX_MODEL_BYTES = 15 * 1024 * 1024 // 15MB — techo duro; lo ideal es 2-3MB comprimido

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

const emptyValues = {
  slug: '',
  name: '',
  category: '',
  brand: '',
  price: '',
  compareAtPrice: '',
  stock: '0',
  featured: false,
  bestSeller: false,
  image: '',
  images: [''],
  shortDescription: '',
  description: '',
  tags: [],
  // "Modelo" y "Código" ya vienen agregados por defecto porque son campos
  // importantes que casi siempre se usan (ver products.js) — solo hay que
  // escribir el valor, o borrar la fila si no aplica.
  specifications: [
    { label: 'Modelo', value: '' },
    { label: 'Código', value: '' },
  ],
  // --- 3D (opcional) ---
  enable3D: false,
  model3DUrl: '',
  model3DPoster: '',
  hotspots: [],
}

// Convierte un producto tal como lo devuelve la API (GET /api/products) en
// los valores iniciales que este formulario necesita, para reutilizarlo
// también al editar un producto existente.
export function productToFormValues(product) {
  return {
    slug: product.slug || '',
    name: product.name || '',
    category: product.category || '',
    brand: product.brand || '',
    price: product.price != null ? String(product.price) : '',
    compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : '',
    stock: product.stock != null ? String(product.stock) : '0',
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    image: product.image || '',
    images: product.images && product.images.length > 0 ? product.images : [''],
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    tags: product.tags || [],
    specifications:
      product.specifications && product.specifications.length > 0
        ? product.specifications.map((s) => ({ label: s.label || '', value: s.value || '' }))
        : [
            { label: 'Modelo', value: '' },
            { label: 'Código', value: '' },
          ],
    enable3D: Boolean(product.enable3D),
    model3DUrl: product.model3DUrl || '',
    model3DPoster: product.model3DPoster || '',
    hotspots: Array.isArray(product.hotspots) ? product.hotspots : [],
  }
}

export default function ProductForm({ categories, initialValues, submitting, onSubmit, onCancel, submitLabel = 'Crear producto' }) {
  const brandHelpId = useId()
  const toast = useContext(ToastContext)
  const { token } = useAuth()
  const [form, setForm] = useState(() => initialValues ?? { ...emptyValues, category: categories[0]?.slug || '' })
  const [tagInput, setTagInput] = useState('')
  // null cuando no hay ninguna subida en curso; si no, el identificador de
  // la fila que se está subiendo ('main' para la imagen principal, o el
  // índice del array `images`).
  const [uploadingKey, setUploadingKey] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setChecked = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.checked }))

  // Imágenes
  const setImageAt = (i, value) => setForm((f) => ({ ...f, images: f.images.map((img, idx) => (idx === i ? value : img)) }))
  const addImage = () => setForm((f) => ({ ...f, images: [...f.images, ''] }))
  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))

  // Sube el archivo elegido a Cloudinary (vía el backend) y coloca la URL
  // resultante en el campo correspondiente — la imagen principal si
  // `key === 'main'`, o la fila `images[key]` si es un número.
  async function handleFileUpload(key, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast?.showToast('Solo se aceptan archivos de imagen.', 'error')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast?.showToast('La imagen pesa demasiado (máximo 5MB).', 'error')
      return
    }

    setUploadingKey(key)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const { url } = await api.admin.uploadImage(dataUrl, token)
      if (key === 'main') {
        setForm((f) => ({ ...f, image: url }))
      } else {
        setImageAt(key, url)
      }
      toast?.showToast('Imagen subida', 'success')
    } catch (err) {
      toast?.showToast(`No se pudo subir la imagen: ${err.message}`, 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  // Igual que handleFileUpload, pero para el modelo 3D — se sube como
  // "raw" en el backend (no es una imagen). Valida extensión y peso
  // antes de intentar subirlo.
  async function handleModelUpload(file) {
    if (!file) return
    const ext = file.name.toLowerCase().split('.').pop()
    if (!['glb', 'gltf'].includes(ext)) {
      toast?.showToast('El modelo debe ser un archivo .glb o .gltf.', 'error')
      return
    }
    if (file.size > MAX_MODEL_BYTES) {
      toast?.showToast('El modelo pesa demasiado (máximo 15MB — lo ideal es comprimirlo a 2-3MB).', 'error')
      return
    }

    setUploadingKey('model3d')
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const { url } = await api.admin.uploadModel(dataUrl, file.name, token)
      setForm((f) => ({ ...f, model3DUrl: url }))
      toast?.showToast('Modelo 3D subido', 'success')
    } catch (err) {
      toast?.showToast(`No se pudo subir el modelo: ${err.message}`, 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  // Tags
  const addTag = () => {
    const value = tagInput.trim()
    if (!value || form.tags.includes(value)) {
      setTagInput('')
      return
    }
    setForm((f) => ({ ...f, tags: [...f.tags, value] }))
    setTagInput('')
  }
  const removeTag = (tag) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  // Especificaciones ({ label, value })
  const setSpecAt = (i, field, value) =>
    setForm((f) => ({ ...f, specifications: f.specifications.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }))
  const addSpec = (label = '') => setForm((f) => ({ ...f, specifications: [...f.specifications, { label, value: '' }] }))
  const removeSpec = (i) => setForm((f) => ({ ...f, specifications: f.specifications.filter((_, idx) => idx !== i) }))

  // Hotspots 3D (Fase H) — solo tienen efecto si enable3D está activo y
  // hay un model3DUrl válido; se guardan igual aunque el 3D esté
  // apagado, por si se reactiva después.
  const setHotspotAt = (i, field, value) =>
    setForm((f) => ({ ...f, hotspots: f.hotspots.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)) }))
  const addHotspot = () =>
    setForm((f) => ({
      ...f,
      hotspots: [...f.hotspots, { id: `hs-${Date.now()}`, x: '0', y: '0', z: '0', title: '', description: '' }],
    }))
  const removeHotspot = (i) => setForm((f) => ({ ...f, hotspots: f.hotspots.filter((_, idx) => idx !== i) }))

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!form.slug.trim() || !form.name.trim() || !form.category || !form.price) {
      toast?.showToast('Completa al menos slug, nombre, categoría y precio.', 'error')
      return
    }

    const images = form.images.map((url) => url.trim()).filter(Boolean)
    const specifications = form.specifications
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label || s.value)
    const hotspots = form.hotspots
      .filter((h) => h.title.trim())
      .map((h) => ({
        id: h.id,
        x: Number(h.x) || 0,
        y: Number(h.y) || 0,
        z: Number(h.z) || 0,
        title: h.title.trim(),
        description: h.description.trim(),
      }))

    onSubmit({
      slug: form.slug.trim(),
      name: form.name.trim(),
      category: form.category,
      brand: form.brand.trim() || null,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice === '' ? null : Number(form.compareAtPrice),
      stock: Number(form.stock || 0),
      featured: form.featured,
      bestSeller: form.bestSeller,
      image: form.image.trim() || images[0] || '',
      images,
      shortDescription: form.shortDescription.trim() || undefined,
      description: form.description.trim() || undefined,
      tags: form.tags,
      specifications: specifications.length ? specifications : undefined,
      enable3D: form.enable3D,
      model3DUrl: form.model3DUrl.trim() || null,
      model3DPoster: form.model3DPoster.trim() || null,
      hotspots: hotspots.length ? hotspots : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-xl2 border border-paper-line p-4 dark:border-night-line sm:p-5">
      {/* Datos principales */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink dark:text-paper">Datos principales</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input className="input-tr" placeholder="slug (ej: cargador-nuevo)" value={form.slug} onChange={set('slug')} />
          <input className="input-tr sm:col-span-2" placeholder="Nombre del producto" value={form.name} onChange={set('name')} />
          <select className="input-tr" value={form.category} onChange={set('category')}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex min-w-0 flex-col gap-1">
            <span id={`${brandHelpId}-label`} className="sr-only">Marca</span>
            <input className="input-tr" placeholder="Marca (ej: UGREEN)" value={form.brand} onChange={set('brand')} aria-labelledby={`${brandHelpId}-label`} aria-describedby={brandHelpId} />
            <span id={brandHelpId} className="text-xs text-ink-soft dark:text-paper/60">Usa una marca creada en Admin → Marcas. Vacío quita la marca.</span>
          </label>
          <input type="number" step="0.01" className="input-tr" placeholder="Precio (S/)" value={form.price} onChange={set('price')} />
          <input
            type="number"
            step="0.01"
            className="input-tr"
            placeholder="Antes de (S/, opcional)"
            value={form.compareAtPrice}
            onChange={set('compareAtPrice')}
          />
          <input type="number" className="input-tr" placeholder="Stock inicial" value={form.stock} onChange={set('stock')} />
          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/60">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={setChecked('featured')}
              className="h-4 w-4 rounded border-paper-line text-route dark:border-night-line"
            />
            Destacado
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/60">
            <input
              type="checkbox"
              checked={form.bestSeller}
              onChange={setChecked('bestSeller')}
              className="h-4 w-4 rounded border-paper-line text-route dark:border-night-line"
            />
            Best seller
          </label>
        </div>
      </div>

      {/* Imágenes */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink dark:text-paper">Imágenes</p>
        <div className="mb-2 flex items-center gap-2">
          <input
            className="input-tr flex-1"
            placeholder="Imagen principal (opcional — si la dejas vacía, se usa la primera de la lista de abajo)"
            value={form.image}
            onChange={set('image')}
          />
          <label
            className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-paper-line px-3 text-xs font-medium text-ink-soft transition-colors hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper ${
              uploadingKey === 'main' ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {uploadingKey === 'main' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Subir
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload('main', e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {form.images.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              {url && (
                <img
                  src={url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded object-cover"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              )}
              <input
                className="input-tr flex-1"
                placeholder={`URL de imagen ${i + 1}`}
                value={url}
                onChange={(e) => setImageAt(i, e.target.value)}
              />
              <label
                className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-paper-line px-3 text-xs font-medium text-ink-soft transition-colors hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper ${
                  uploadingKey === i ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {uploadingKey === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(i, e.target.files?.[0])} />
              </label>
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-signal-red hover:bg-signal-red/10"
                aria-label="Quitar imagen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addImage} className="btn-secondary mt-2 inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Agregar imagen
        </button>
      </div>

      {/* Descripciones */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink dark:text-paper">Descripción</p>
        <input
          className="input-tr mb-2"
          placeholder="Descripción corta"
          value={form.shortDescription}
          onChange={set('shortDescription')}
        />
        <textarea
          className="input-tr min-h-[120px] resize-y py-2 text-sm leading-relaxed"
          placeholder={'Descripción completa. Puedes usar líneas con "•" para viñetas, igual que en products.js.'}
          value={form.description}
          onChange={set('description')}
        />
      </div>

      {/* Tags */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink dark:text-paper">Etiquetas (tags)</p>
        {form.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {form.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-route-soft px-2.5 py-1 text-xs font-medium text-route dark:bg-route-softDark"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} aria-label={`Quitar ${tag}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="input-tr flex-1"
            placeholder="Escribe una etiqueta y presiona Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
          />
          <button type="button" onClick={addTag} className="btn-secondary shrink-0">
            Agregar
          </button>
        </div>
      </div>

      {/* Especificaciones */}
      <div>
        <p className="mb-1 text-sm font-semibold text-ink dark:text-paper">Especificaciones</p>
        <p className="mb-2 text-xs text-ink-soft dark:text-paper/50">
          Cada fila es un par etiqueta / valor (ej: "Modelo" → "EC602"). "Modelo" y "Código" ya están agregados abajo — solo
          completa el valor o bórralos si no aplican.
        </p>
        <div className="flex flex-col gap-2">
          {form.specifications.map((spec, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input-tr w-40 shrink-0"
                placeholder="Etiqueta (ej: Modelo)"
                value={spec.label}
                onChange={(e) => setSpecAt(i, 'label', e.target.value)}
              />
              <input
                className="input-tr flex-1"
                placeholder="Valor"
                value={spec.value}
                onChange={(e) => setSpecAt(i, 'value', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeSpec(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-signal-red hover:bg-signal-red/10"
                aria-label="Quitar especificación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => addSpec()} className="btn-secondary inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Agregar especificación
          </button>
          <button type="button" onClick={() => addSpec('Modelo')} className="btn-secondary">
            + Modelo
          </button>
          <button type="button" onClick={() => addSpec('Código')} className="btn-secondary">
            + Código
          </button>
        </div>
      </div>

      <div className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
        <label className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enable3D}
            onChange={setChecked('enable3D')}
            className="h-4 w-4 rounded text-route focus:ring-route"
          />
          <span className="font-display text-sm font-semibold text-ink dark:text-paper">Visor 3D</span>
          <span className="text-xs text-ink-soft/70 dark:text-paper/40">(opcional — si lo dejas apagado, la ficha usa la galería de imágenes normal)</span>
        </label>

        {form.enable3D && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft dark:text-paper/60">URL del modelo (.glb o .gltf)</span>
              <div className="flex items-center gap-2">
                <input className="input-tr flex-1" value={form.model3DUrl} onChange={set('model3DUrl')} placeholder="https://.../producto.glb" />
                <label
                  className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-paper-line px-3 text-xs font-medium text-ink-soft transition-colors hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper ${
                    uploadingKey === 'model3d' ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  {uploadingKey === 'model3d' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Subir
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    className="hidden"
                    onChange={(e) => handleModelUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
              <span className="text-xs text-ink-soft/70 dark:text-paper/40">Máximo 15MB — lo ideal es 2-3MB comprimido.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft dark:text-paper/60">Imagen de respaldo (poster)</span>
              <input
                className="input-tr"
                value={form.model3DPoster}
                onChange={set('model3DPoster')}
                placeholder="Se muestra mientras carga el 3D, o si el dispositivo no lo soporta"
              />
            </label>

            <div>
              <p className="mb-2 text-xs font-medium text-ink-soft dark:text-paper/60">Hotspots (opcional)</p>
              <div className="flex flex-col gap-2">
                {form.hotspots.map((h, i) => (
                  <div key={h.id || i} className="grid grid-cols-1 gap-2 rounded-lg border border-paper-line/70 p-3 dark:border-night-line/70 sm:grid-cols-[repeat(3,4.5rem)_1fr_auto]">
                    <input className="input-tr" type="number" step="0.1" placeholder="x" value={h.x} onChange={(e) => setHotspotAt(i, 'x', e.target.value)} />
                    <input className="input-tr" type="number" step="0.1" placeholder="y" value={h.y} onChange={(e) => setHotspotAt(i, 'y', e.target.value)} />
                    <input className="input-tr" type="number" step="0.1" placeholder="z" value={h.z} onChange={(e) => setHotspotAt(i, 'z', e.target.value)} />
                    <input
                      className="input-tr"
                      placeholder="Título (ej: Puerto USB-C)"
                      value={h.title}
                      onChange={(e) => setHotspotAt(i, 'title', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeHotspot(i)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-signal-red hover:bg-signal-red/10"
                      aria-label="Quitar hotspot"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <textarea
                      className="input-tr sm:col-span-5"
                      rows={2}
                      placeholder="Descripción"
                      value={h.description}
                      onChange={(e) => setHotspotAt(i, 'description', e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <button type="button" onClick={addHotspot} className="btn-secondary mt-2 inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Agregar hotspot
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={submitting || uploadingKey !== null} className="btn-primary">
          {submitting ? 'Guardando…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-ink-soft hover:text-ink dark:text-paper/60 dark:hover:text-paper"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
