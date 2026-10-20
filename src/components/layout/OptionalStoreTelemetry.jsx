import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackStoreEvent } from '../../utils/storeEvents.js'
export default function OptionalStoreTelemetry() {
  const { pathname } = useLocation()
  const previous = useRef(null)
  useEffect(() => {
    if (!import.meta.env.VITE_ERROR_MONITOR_DSN) return
    let live = true, stop
    void import('../../optional/errors.js').then(module => {
      if (live) stop = module.startErrors()
    }).catch(() => {})
    return () => { live = false; stop?.() }
  }, [])
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (!/^\/(?:$|catalogo$|categorias$|marcas$|producto\/|categoria\/|marca\/|ayuda$|carrito$|checkout$)/.test(pathname)) return
    trackStoreEvent('pageview')
    if (pathname === '/checkout') trackStoreEvent('Inicio de checkout')
  }, [pathname])
  return null
}
