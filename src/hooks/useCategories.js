import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { categories as staticCategories } from '../data/categories.js'
import { useCategoryTree } from './useSiteContent.js'
import { flattenTree } from '../utils/categoryTree.js'

// Categorías del sitio.
//   • `categories` / `tree`: SOLO las de primer nivel visibles del árbol
//     nuevo (con `children`). Las 8 heredadas ya no aparecen en menús,
//     filtros ni en la Home.
//   • `getCategoryBySlug`: resuelve cualquier slug (árbol o heredado) para
//     rotular fichas de producto y enlaces antiguos.
let legacyPromise = null
function loadLegacy() {
  if (!legacyPromise) {
    legacyPromise = api.getCategories().catch((err) => {
      console.warn('No se pudo obtener las categorías heredadas de la API, usando datos locales:', err.message)
      return staticCategories
    })
  }
  return legacyPromise
}

export function useCategories() {
  const { tree, loading } = useCategoryTree()
  const [legacy, setLegacy] = useState(staticCategories)

  useEffect(() => {
    let activo = true
    loadLegacy().then((data) => {
      if (activo && Array.isArray(data) && data.length > 0) setLegacy(data)
    })
    return () => {
      activo = false
    }
  }, [])

  const flat = useMemo(() => flattenTree(tree), [tree])
  const getCategoryBySlug = useCallback((slug) => flat.find((c) => c.slug === slug) ?? legacy.find((c) => c.slug === slug), [flat, legacy])

  return { categories: tree, tree, loading, getCategoryBySlug }
}