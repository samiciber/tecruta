import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { categories as staticCategories } from '../data/categories.js'

// Categorías que usan el header, el menú móvil, los filtros del catálogo,
// la Home y las fichas de producto.
//
// A diferencia de useProductIndex (que empieza vacío y muestra un estado
// de carga), este hook se inicializa DE INMEDIATO con las categorías
// estáticas ya empaquetadas en el frontend — así el menú y los filtros
// nunca aparecen vacíos ni parpadean mientras carga. En paralelo, intenta
// traer la versión actual desde la API y, si lo logra, la reemplaza; si
// la API no responde, se queda tranquilamente con las estáticas.
let cachePromise = null

function cargarCategorias() {
  if (!cachePromise) {
    cachePromise = api.getCategories().catch((err) => {
      console.warn('No se pudo obtener las categorías de la API, usando datos locales:', err.message)
      return staticCategories
    })
  }
  return cachePromise
}

export function useCategories() {
  const [categories, setCategories] = useState(staticCategories)

  useEffect(() => {
    let activo = true
    cargarCategorias().then((data) => {
      if (activo && Array.isArray(data) && data.length > 0) setCategories(data)
    })
    return () => {
      activo = false
    }
  }, [])

  const getCategoryBySlug = (slug) => categories.find((c) => c.slug === slug)

  return { categories, getCategoryBySlug }
}