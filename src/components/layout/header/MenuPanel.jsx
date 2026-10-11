import React, { useMemo, useState } from 'react'
import FloatingPanel from './FloatingPanel.jsx'
import EntryList from './EntryList.jsx'
import SubPanel from './SubPanel.jsx'
import { buildMenuEntries } from './entries.js'
import { useBrands, useCategoryTree, useSiteSettings } from '../../../hooks/useSiteContent.js'

// Menú principal (antes "Tienda"), multinivel y 100 % administrable (Admin → Menú
// para el primer nivel; Admin → Categorías para los niveles inferiores):
//   Comprar por marca → marcas destacadas + «Todas las marcas»
//   Categoría → «Explora X» + subcategorías → (3.er nivel) → página de categoría.
// Una categoría sin hijos navega directo a /categoria/:slug.
export default function MenuPanel({ triggerRef, onClose }) {
  const { tree } = useCategoryTree()
  const { featured } = useBrands()
  const { settings } = useSiteSettings()
  const [sub, setSub] = useState(null)

  // Filas, etiquetas y textos vienen de Admin → Menú (site_settings) y se
  // revalidan solos; sin configuración se comporta como siempre.
  const entries = useMemo(() => {
    const rows = buildMenuEntries({ tree, featured, layout: settings.menuLayout, texts: settings.menuTexts })
    return rows.length > 0 ? rows : [{ kind: 'link', label: 'Todos los productos', to: '/catalogo' }]
  }, [tree, featured, settings.menuLayout, settings.menuTexts])

  return (
    <FloatingPanel
      id="panel-menu"
      title="Menú"
      width="w-[20rem]"
      triggerRef={triggerRef}
      onClose={onClose}
      side={sub && <SubPanel key={sub.title} node={sub} onClose={() => setSub(null)} onNavigate={onClose} />}
    >
      <EntryList entries={entries} onNavigate={onClose} onNext={(e) => setSub(e.next)} activeKey={sub?.title} tall label="Menú" />
    </FloatingPanel>
  )
}