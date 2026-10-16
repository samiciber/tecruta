import { useCallback, useEffect } from 'react'
import { api } from '../services/api.js'
import { invalidate, useCachedResource } from './useCachedResource.js'

export function useHome() {
  const resource = useCachedResource('home', api.getHome, { fallback: null, ttl: 30_000 })
  const revalidateAt = resource.data?.revalidateAt
  const refresh = useCallback(() => invalidate('home'), [])

  useEffect(() => {
    if (!revalidateAt) return undefined
    const delay = Math.max(0, new Date(revalidateAt).getTime() - Date.now() + 50)
    const timer = window.setTimeout(refresh, delay)
    return () => window.clearTimeout(timer)
  }, [revalidateAt, refresh])

  return { ...resource, refresh }
}
