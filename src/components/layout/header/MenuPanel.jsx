import React, { useMemo, useState } from 'react'
import FloatingPanel from './FloatingPanel.jsx'
import EntryList from './EntryList.jsx'
import SubPanel from './SubPanel.jsx'
import { brandsToEntries, categoriesToEntries } from './entries.js'
import { useBrands, useCategoryTree } from '../../../hooks/useSiteContent.js'

// Menú principal (antes "Tienda"), multinivel y 100 % desde la BD:
//   Comprar por marca → marcas destacadas + «Todas las marcas»
//   Categoría → «Explora X» + subcategorías → (3.er nivel) → página de categoría.
// Una categoría sin hijos navega directo a /categoria/:slug.
export default function MenuPanel({ triggerRef, onClose }) {
  const { tree } = useCategoryTree()
  const { featured } = useBrands()
  const [sub, setSub] = useState(null)

  const entries = useMemo(
    () => [
      { kind: 'next', label: 'Comprar por marca', next: { title: 'Comprar por marca', entries: brandsToEntries(featured) } },
      ...categoriesToEntries(tree),
      ...(tree.length === 0 ? [{ kind: 'link', label: 'Todos los productos', to: '/catalogo' }] : []),
    ],
    [tree, featured],
  )

  return (
    <FloatingPanel
      id="panel-menu"
      title="Menú"
      width="w-[20rem]"
      triggerRef={triggerRef}
      onClose={onClose}
      side={sub && <SubPanel node={sub} onClose={() => setSub(null)} onNavigate={onClose} />}
    >
      <EntryList entries={entries} onNavigate={onClose} onNext={(e) => setSub(e.next)} activeKey={sub?.title} tall label="Menú" />
    </FloatingPanel>
  )
}