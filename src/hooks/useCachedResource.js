import { useCallback, useEffect, useRef, useState } from 'react'

// Caché de contenido editable con revalidación al montaje, al volver a la
// pestaña y al invalidar. Productos/pagos usan liveResource con TTL activo
// y un estado explícito de verificación para permitir compras.
//
// Estrategia stale-while-revalidate:
//   • Muestra de inmediato lo último que se tuvo (o el `fallback`).
//   • Si el dato tiene más de `ttl` ms, lo vuelve a pedir en segundo plano.
//   • Revalida al volver a la pestaña (visibilitychange).
//   • `invalidate(key)` lo marca vencido; el admin lo llama tras guardar,
//     así los cambios se ven sin recargar a mano.
// Si la API falla se conserva el último dato bueno o el fallback.

const cache = new Map() // key → { data, ts, promise }
const listeners = new Map() // key → Set<fn>

const subscribe = (key, fn) => {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(fn)
  return () => listeners.get(key)?.delete(fn)
}

const notify = (key) => listeners.get(key)?.forEach((fn) => fn())

function load(key, fetcher) {
  const entry = cache.get(key) || { data: undefined, ts: 0, promise: null }
  if (entry.promise) return entry.promise
  entry.promise = fetcher()
    .then((data) => {
      entry.data = data
      entry.ts = Date.now()
      entry.error = null
    })
    .catch((err) => {
      entry.error = err
      // Reintenta pronto, pero no en bucle: marca el intento.
      entry.ts = Date.now() - 1000 * 50
    })
    .finally(() => {
      entry.promise = null
      cache.set(key, entry)
      notify(key)
    })
  cache.set(key, entry)
  return entry.promise
}

// Marca como vencidos los recursos cuyo key empieza con `prefix` y avisa a
// los hooks montados para que refresquen YA.
export function invalidate(prefix = '') {
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) entry.ts = 0
  }
  for (const key of listeners.keys()) {
    if (key.startsWith(prefix)) notify(key)
  }
}

export function useCachedResource(key, fetcher, { fallback, ttl = 60_000 } = {}) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const [, force] = useState(0)

  const revalidate = useCallback(
    (maxAge = ttl) => {
      const entry = cache.get(key)
      if (!entry || Date.now() - entry.ts >= maxAge) load(key, () => fetcherRef.current())
    },
    [key, ttl],
  )

  useEffect(() => {
    const unsubscribe = subscribe(key, () => {
      force((n) => n + 1)
      // Si fue invalidado (ts = 0) mientras estaba montado, recarga.
      const entry = cache.get(key)
      if (!entry || entry.ts === 0) load(key, () => fetcherRef.current())
    })
    revalidate()
    const onVisible = () => document.visibilityState === 'visible' && revalidate()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, revalidate])

  const entry = cache.get(key)
  const hasData = entry?.data !== undefined
  return {
    data: hasData ? entry.data : fallback,
    loading: !hasData && !entry?.error,
    error: entry?.error ?? null,
    isFallback: !hasData,
    refresh: () => invalidate(key),
  }
}
