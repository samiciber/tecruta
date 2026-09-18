import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

// Índice de productos que usan el catálogo, el inicio, el carrito y las
// fichas de producto (vía CartContext, CartUpsell, Catalog, Home,
// ProductDetail — todos consumen este mismo hook, nunca el archivo
// estático directamente).
//
// Primero intenta traerlo de la API (server/ + base de datos real). Si la
// API no responde — no está corriendo en desarrollo, o el sitio todavía
// no la tiene desplegada — cae de vuelta al índice estático empaquetado
// en el frontend, para que la tienda nunca deje de funcionar por esto.
let cachePromise = null

function cargarIndice() {
  if (!cachePromise) {
    cachePromise = api.getProducts().catch(async (err) => {
      console.warn('No se pudo obtener el catálogo de la API, usando datos locales:', err.message)
      const mod = await import('../data/productIndex.js')
      return mod.productIndex
    })
  }
  return cachePromise
}

export function useProductIndex() {
  const [index, setIndex] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true
    cargarIndice().then((data) => {
      if (activo) {
        setIndex(data)
        setLoading(false)
      }
    })
    return () => {
      activo = false
    }
  }, [])

  return { index: index || [], loading }
}