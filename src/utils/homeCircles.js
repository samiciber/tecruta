import { countProducts, flattenTree } from './categoryTree.js'

// Valores por defecto = el comportamiento ANTERIOR (categorías raíz con
// productos), de modo que sin configuración la Home no cambia.
export const DEFAULT_HOME_CIRCLES = { title: 'Compra por categoría', onlyWithProducts: true, max: null, items: null }

const isExternal = (h) => /^https?:\/\//.test(h || '')

// Configuración + árbol visible + productos → lista final de círculos:
//   [{ key, label, to, image, external }]
// Una categoría que ya no existe o está oculta se omite sin error.
export function resolveCircles({ config, tree = [], products = [] }) {
  const cfg = { ...DEFAULT_HOME_CIRCLES, ...(config || {}) }
  const byId = new Map(flattenTree(tree).map((n) => [n.id, n]))
  const items = Array.isArray(cfg.items)
    ? cfg.items
    : tree.map((n) => ({ id: `cat-${n.id}`, type: 'category', categoryId: n.id, label: '', image: null, visible: true }))

  const out = []
  for (const it of items) {
    if (it.visible === false) continue
    if (it.type === 'custom') {
      out.push({ key: it.id, label: it.label, to: it.href, image: it.image || null, external: isExternal(it.href) })
      continue
    }
    const node = byId.get(it.categoryId)
    if (!node) continue
    if (cfg.onlyWithProducts && countProducts(node, products) === 0) continue
    out.push({ key: it.id, label: (it.label || '').trim() || node.name, to: `/categoria/${node.slug}`, image: it.image || node.image || null, external: false })
  }
  return cfg.max ? out.slice(0, cfg.max) : out
}