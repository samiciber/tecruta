import React from 'react'
import { Link } from 'react-router-dom'
import { Check, Field } from './adminUi.jsx'
import { BENEFIT_ICONS } from '../home/HomeContentSections.jsx'

const input = 'input-tr h-9 py-0'
const blankAccess = newId => ({ id: newId(), title: '', description: '', image: '', href: '' })
const blankTab = newId => ({ id: newId(), label: '', image: '', imageAlt: '', links: [blankAccess(newId)] })

export function createAdditionalSection(type, newId) {
  const base = { id: newId(), type, active: true, title: '' }
  if (type === 'splitRow') return { ...base, ratio: '50/50', reverse: false, bannerId: '', panelKind: 'categories', categorySlugs: [], limit: 6 }
  if (type === 'editorialTiles') return { ...base, columns: 4, items: Array.from({ length: 4 }, () => blankAccess(newId)) }
  if (type === 'brands') return { ...base, limit: 8 }
  if (type === 'benefits') return { ...base, items: [] }
  if (type === 'supportLinks') return base
  if (type === 'legalText') return { ...base, text: '' }
  if (type === 'useSelections') return { ...base, tabs: [blankTab(newId)] }
  return null
}

function TextField({ label, value, onChange, maxLength = 100, multiline = false }) {
  return <Field label={label}>{multiline
    ? <textarea className="input-tr min-h-24 py-2" value={value || ''} maxLength={maxLength} onChange={event => onChange(event.target.value)} />
    : <input className={input} value={value || ''} maxLength={maxLength} onChange={event => onChange(event.target.value)} />}</Field>
}

function AccessEditor({ item, onChange, imageRequired = false }) {
  const patch = value => onChange({ ...item, ...value })
  return <div className="grid gap-3 sm:grid-cols-2">
    <TextField label="Título del acceso" value={item.title} onChange={title => patch({ title })} />
    <TextField label="Enlace del acceso" value={item.href} maxLength={500} onChange={href => patch({ href })} />
    <TextField label={imageRequired ? 'Imagen del tile (URL)' : 'Imagen del acceso (URL, opcional)'} value={item.image} maxLength={1000} onChange={image => patch({ image })} />
    {imageRequired && <TextField label="Imagen móvil del tile (opcional)" value={item.imageMobile} maxLength={1000} onChange={imageMobile => patch({ imageMobile })} />}
    <TextField label="Texto alternativo de la imagen" value={item.imageAlt} maxLength={160} onChange={imageAlt => patch({ imageAlt })} />
    <TextField label="Descripción opcional" value={item.description} maxLength={500} onChange={description => patch({ description })} />
  </div>
}

function ItemButtons({ index, count, onMove, onRemove }) {
  return <div className="mt-3 flex flex-wrap gap-3 text-xs">
    <button type="button" className="btn-ghost disabled:opacity-40" disabled={index === 0} onClick={() => onMove(-1)}>Subir elemento</button>
    <button type="button" className="btn-ghost disabled:opacity-40" disabled={index === count - 1} onClick={() => onMove(1)}>Bajar elemento</button>
    {onRemove && <button type="button" className="btn-ghost text-signal-red" onClick={() => { if (window.confirm('¿Quitar este elemento y su contenido del borrador?')) onRemove() }}>Quitar elemento</button>}
  </div>
}

function moveItem(items, index, direction) {
  const next = [...items]
  const target = index + direction
  if (target < 0 || target >= next.length) return items
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export default function HomeAdditionalEditor({ section, onChange, categories, brands, banners, SourceEditor, newId }) {
  if (!['splitRow', 'editorialTiles', 'brands', 'benefits', 'supportLinks', 'legalText', 'useSelections'].includes(section.type)) return null
  const patch = value => onChange({ ...section, ...value })
  const updateItem = (index, item) => patch({ items: section.items.map((value, i) => i === index ? item : value) })
  const updateTab = (index, tab) => patch({ tabs: section.tabs.map((value, i) => i === index ? tab : value) })
  return <div className="mt-4 space-y-4">
    <TextField label="Título de sección (opcional)" value={section.title} onChange={title => patch({ title })} />
    {section.type === 'splitRow' && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Banner editorial existente"><select className={input} value={section.bannerId} onChange={event => patch({ bannerId: event.target.value })}>
          <option value="">Sin banner</option>
          {banners.map(banner => <option key={banner.id} value={banner.id}>{banner.title || banner.id}{banner.active ? '' : ' (inactivo)'}</option>)}
        </select></Field>
        <Field label="Proporción banner/panel"><select className={input} value={section.ratio} onChange={event => patch({ ratio: event.target.value })}><option>50/50</option><option>60/40</option></select></Field>
        <Check label="Panel antes del banner" checked={section.reverse} onChange={reverse => patch({ reverse })} />
        <Field label="Contenido del panel"><select className={input} value={section.panelKind} onChange={event => patch({ panelKind: event.target.value })}><option value="categories">Categorías</option><option value="products">Productos</option></select></Field>
        <Field label="Límite del panel (1–20)"><input className={input} type="number" min="1" max="20" value={section.limit} onChange={event => patch({ limit: Number(event.target.value) })} /></Field>
      </div>
      {section.panelKind === 'categories' ? <fieldset className="space-y-2"><legend className="mb-2 text-sm">Categorías del panel (máximo 12; orden de selección)</legend>
        {categories.map(category => <Check key={category.slug} label={category.name} checked={section.categorySlugs.includes(category.slug)} onChange={selected => patch({ categorySlugs: selected ? [...section.categorySlugs, category.slug].slice(0, 12) : section.categorySlugs.filter(slug => slug !== category.slug) })} />)}
        {!categories.length && <p className="text-sm">No hay categorías visibles.</p>}
      </fieldset> : section.source ? <SourceEditor source={section.source} categories={categories} brands={brands} onChange={source => patch({ source })} /> : <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => patch({ source: { id: newId(), label: 'Destacados', kind: 'featured' } })}>Configurar fuente de productos</button>}
      <p className="text-xs text-ink-soft dark:text-paper/70">Edita imágenes, textos y botones en <Link className="underline" to="/admin/banners">Banners del Home</Link>. Si falta un lado, el otro ocupa el ancho completo.</p>
    </>}
    {section.type === 'editorialTiles' && <>
      <Field label="Cantidad de tiles"><select className={input} value={section.columns} onChange={event => {
        const columns = Number(event.target.value)
        if (columns < section.items.length && !window.confirm('¿Quitar el quinto tile? Se perderá su contenido al guardar.')) return
        patch({ columns, items: Array.from({ length: columns }, (_, i) => section.items[i] || blankAccess(newId)) })
      }}><option value="4">Cuatro</option><option value="5">Cinco</option></select></Field>
      {section.items.map((item, index) => <fieldset key={item.id} className="rounded-lg border border-paper-line p-3 dark:border-night-line"><legend className="px-1 text-sm">Tile {index + 1}</legend>
        <AccessEditor item={item} imageRequired onChange={value => updateItem(index, value)} />
        <ItemButtons index={index} count={section.items.length} onMove={direction => patch({ items: moveItem(section.items, index, direction) })} />
      </fieldset>)}
      <p className="text-xs text-ink-soft dark:text-paper/70">Completa todos los tiles para publicar la sección. Se admiten borradores incompletos.</p>
    </>}
    {section.type === 'brands' && <Field label="Límite de marcas (1–24)"><input type="number" min="1" max="24" className={input} value={section.limit} onChange={event => patch({ limit: Number(event.target.value) })} /></Field>}
    {section.type === 'brands' && <p className="text-xs text-ink-soft dark:text-paper/70">Usa marcas visibles con productos en el catálogo, destacadas primero. Edita sus logos y orden en <Link to="/admin/marcas" className="underline">Marcas</Link>.</p>}
    {section.type === 'benefits' && <>
      {section.items.map((item, index) => <fieldset key={item.id} className="space-y-3 rounded-lg border border-paper-line p-3 dark:border-night-line"><legend className="px-1 text-sm">Beneficio {index + 1}</legend>
        <Field label="Icono permitido"><select className={input} value={item.icon} onChange={event => updateItem(index, { ...item, icon: event.target.value })}>{Object.keys(BENEFIT_ICONS).map(icon => <option key={icon}>{icon}</option>)}</select></Field>
        <TextField label="Título del beneficio" value={item.title} onChange={title => updateItem(index, { ...item, title })} />
        <TextField multiline label="Texto del beneficio" value={item.text} maxLength={500} onChange={text => updateItem(index, { ...item, text })} />
        <ItemButtons index={index} count={section.items.length} onMove={direction => patch({ items: moveItem(section.items, index, direction) })} onRemove={() => patch({ items: section.items.filter((_, i) => i !== index) })} />
      </fieldset>)}
      <button type="button" className="btn-secondary px-3 py-2 text-xs disabled:opacity-40" disabled={section.items.length >= 4} onClick={() => patch({ items: [...section.items, { id: newId(), icon: 'info', title: '', text: '' }] })}>Agregar beneficio</button>
      <p className="text-xs text-ink-soft dark:text-paper/70">Texto plano. Publica únicamente beneficios y condiciones definidos por TecRuta.</p>
    </>}
    {section.type === 'supportLinks' && <p className="text-sm text-ink-soft dark:text-paper/70">Reutiliza los cinco enlaces del carrito, con sus textos y destinos existentes. Se editan una sola vez en <Link to="/admin/ajustes" className="underline">Ajustes del sitio</Link>. Sin configuración válida, la sección se oculta.</p>}
    {section.type === 'legalText' && <TextField multiline label="Texto legal (texto plano)" value={section.text} maxLength={6000} onChange={text => patch({ text })} />}
    {section.type === 'useSelections' && <>
      {section.tabs.map((tab, index) => <fieldset key={tab.id} className="space-y-4 rounded-lg border border-paper-line p-3 dark:border-night-line"><legend className="px-1 text-sm">Pestaña {index + 1}</legend>
        <TextField label="Nombre de pestaña" value={tab.label} maxLength={60} onChange={label => updateTab(index, { ...tab, label })} />
        <TextField label="Imagen de la pestaña (URL)" value={tab.image} maxLength={1000} onChange={image => updateTab(index, { ...tab, image })} />
        <TextField label="Imagen móvil de la pestaña (opcional)" value={tab.imageMobile} maxLength={1000} onChange={imageMobile => updateTab(index, { ...tab, imageMobile })} />
        <TextField label="Texto alternativo de imagen" value={tab.imageAlt} maxLength={160} onChange={imageAlt => updateTab(index, { ...tab, imageAlt })} />
        {tab.links.map((item, linkIndex) => <fieldset key={item.id} className="rounded-lg border border-paper-line p-3 dark:border-night-line"><legend className="px-1 text-xs">Acceso {linkIndex + 1}</legend>
          <AccessEditor item={item} onChange={value => updateTab(index, { ...tab, links: tab.links.map((link, i) => i === linkIndex ? value : link) })} />
          <ItemButtons index={linkIndex} count={tab.links.length} onMove={direction => updateTab(index, { ...tab, links: moveItem(tab.links, linkIndex, direction) })} onRemove={() => updateTab(index, { ...tab, links: tab.links.filter((_, i) => i !== linkIndex) })} />
        </fieldset>)}
        <button type="button" className="btn-secondary px-3 py-2 text-xs disabled:opacity-40" disabled={tab.links.length >= 6} onClick={() => updateTab(index, { ...tab, links: [...tab.links, blankAccess(newId)] })}>Agregar acceso</button>
        <ItemButtons index={index} count={section.tabs.length} onMove={direction => patch({ tabs: moveItem(section.tabs, index, direction) })} onRemove={() => patch({ tabs: section.tabs.filter((_, i) => i !== index) })} />
      </fieldset>)}
      <button type="button" className="btn-secondary px-3 py-2 text-xs disabled:opacity-40" disabled={section.tabs.length >= 8} onClick={() => patch({ tabs: [...section.tabs, blankTab(newId)] })}>Agregar pestaña</button>
    </>}
  </div>
}
