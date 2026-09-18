import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { paymentConfig } from '../config/paymentConfig.js'

// Métodos de pago mostrados en el Checkout.
//
// Mismo patrón que useCategories: se inicializa de inmediato con los
// datos estáticos de paymentConfig.js (para que el checkout nunca
// aparezca vacío) y, en paralelo, intenta traer la versión real desde
// la API (/api/payment-methods) — la misma fuente que edita el panel
// de administración. Si la API no responde, se queda con los estáticos.
function paymentConfigToStaticList() {
  return Object.entries(paymentConfig)
    .filter(([, cfg]) => cfg.enabled)
    .map(([key, cfg]) => {
      const { enabled, label, ...config } = cfg
      return { key, label, config }
    })
}

const staticMethods = paymentConfigToStaticList()

let cachePromise = null

function cargarMetodosPago() {
  if (!cachePromise) {
    cachePromise = api.getPaymentMethods().catch((err) => {
      console.warn('No se pudo obtener los métodos de pago de la API, usando datos locales:', err.message)
      return staticMethods
    })
  }
  return cachePromise
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState(staticMethods)

  useEffect(() => {
    let activo = true
    cargarMetodosPago().then((data) => {
      if (activo && Array.isArray(data) && data.length > 0) setMethods(data)
    })
    return () => {
      activo = false
    }
  }, [])

  const getMethodByKey = (key) => methods.find((m) => m.key === key)

  return { methods, getMethodByKey }
}
