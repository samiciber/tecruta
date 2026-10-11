// Convierte datos (ítems de menú, árbol de categorías, marcas) en una lista
// uniforme de "entradas" que renderizan por igual el panel de escritorio y
// el menú móvil por niveles.
//   { kind: 'link', label, to } | { kind: 'next', label, next: { title, entries } }
//   { kind: 'heading', label } | { kind: 'divider' }

export const SOON = '/proximamente'
export const isExternal = (href) => /^https?:\/\//.test(href || '')

export function navToEntries(items = []) {
  return items.map((it) => {
    if (it.type === 'HEADING') return { kind: 'heading', label: it.label }
    if (it.type === 'DIVIDER') return { kind: 'divider' }
    if (it.type === 'SUBMENU') {
      return { kind: 'next', label: it.label, next: { title: it.label, entries: navToEntries(it.children || []), empty: !(it.children || []).length } }
    }
    return { kind: 'link', label: it.label, to: it.href || SOON }
  })
}

// Textos por defecto del Menú (editables en Admin → Menú).
export const DEFAULT_MENU_TEXTS = { exploreTemplate: 'Explora {name}', allBrandsLabel: 'Todas las marcas' }
export const DEFAULT_BRANDS_LABEL = 'Comprar por marca'

const fill = (template, name) => String(template || DEFAULT_MENU_TEXTS.exploreTemplate).replaceAll('{name}', name)

// Una categoría del árbol → fila. `override` ({ label, href }) solo aplica al
// primer nivel (filas editadas en Admin → Menú).
function categoryEntry(node, texts, override) {
  const name = override?.label || node.name
  const to = override?.href || `/categoria/${node.slug}`
  if (!node.children?.length) return { kind: 'link', label: name, to }
  return {
    kind: 'next',
    label: name,
    next: {
      title: name,
      entries: [{ kind: 'link', label: fill(texts.exploreTemplate, name), to }, ...categoriesToEntries(node.children, texts)],
    },
  }
}

export function categoriesToEntries(nodes = [], texts = DEFAULT_MENU_TEXTS) {
  return nodes.map((n) => categoryEntry(n, texts))
}

export function brandsToEntries(featured = [], texts = DEFAULT_MENU_TEXTS) {
  return [
    ...featured.map((b) => ({ kind: 'link', label: b.name, to: `/marca/${b.slug}` })),
    { kind: 'link', label: texts.allBrandsLabel || DEFAULT_MENU_TEXTS.allBrandsLabel, to: '/marcas' },
  ]
}

// Primer nivel del Menú: respeta el orden/etiquetas/visibilidad de `layout`
// (Admin → Menú). Sin `layout` = comportamiento original: «Comprar por marca»
// primero y luego las categorías en el orden del árbol. Las categorías raíz que
// no tienen fila (p. ej. recién creadas) se agregan al final, para que nunca
// desaparezca una por no estar en el layout.
export function buildMenuEntries({ tree = [], featured = [], layout = null, texts = null }) {
  const t = { ...DEFAULT_MENU_TEXTS, ...(texts || {}) }
  const rows = Array.isArray(layout) ? layout : [{ id: 'brands', type: 'brands', visible: true }]
  const byId = new Map(tree.map((n) => [n.id, n]))
  const used = new Set()
  const out = []
  for (const row of rows) {
    if (row.type === 'category') used.add(row.categoryId)
    if (row.visible === false) continue
    if (row.type === 'brands') {
      const label = row.label || DEFAULT_BRANDS_LABEL
      out.push({ kind: 'next', label, next: { title: label, entries: brandsToEntries(featured, t) } })
    } else if (row.type === 'category') {
      const node = byId.get(row.categoryId)
      if (node) out.push(categoryEntry(node, t, { label: row.label, href: row.href }))
    } else if (row.type === 'custom') {
      out.push({ kind: 'link', label: row.label, to: row.href })
    }
  }
  for (const node of tree) if (!used.has(node.id)) out.push(categoryEntry(node, t))
  return out
}