// Utilidades para el árbol de categorías ({ slug, name, children }).

export function flattenTree(tree = [], out = []) {
  for (const node of tree) {
    out.push(node)
    flattenTree(node.children || [], out)
  }
  return out
}

export const findNode = (tree, slug) => flattenTree(tree).find((n) => n.slug === slug) ?? null

// Slug del nodo + los de todos sus descendientes.
export function descendantSlugs(node) {
  if (!node) return []
  return [node.slug, ...(node.children || []).flatMap(descendantSlugs)]
}

export function countProducts(node, products) {
  const set = new Set(descendantSlugs(node))
  return products.reduce((n, p) => n + (set.has(p.category) ? 1 : 0), 0)
}

// Ruta desde la raíz hasta el nodo: [{ slug, name }, …]
export function pathTo(tree, slug, trail = []) {
  for (const node of tree) {
    const here = [...trail, { slug: node.slug, name: node.name }]
    if (node.slug === slug) return here
    const found = pathTo(node.children || [], slug, here)
    if (found) return found
  }
  return null
}

export const slugifyText = (text) =>
  String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')