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

export function categoriesToEntries(nodes = []) {
  return nodes.map((n) =>
    n.children?.length
      ? {
          kind: 'next',
          label: n.name,
          next: {
            title: n.name,
            entries: [{ kind: 'link', label: `Explora ${n.name}`, to: `/categoria/${n.slug}` }, ...categoriesToEntries(n.children)],
          },
        }
      : { kind: 'link', label: n.name, to: `/categoria/${n.slug}` },
  )
}

export function brandsToEntries(featured = []) {
  return [...featured.map((b) => ({ kind: 'link', label: b.name, to: `/marca/${b.slug}` })), { kind: 'link', label: 'Todas las marcas', to: '/marcas' }]
}