import { useSyncExternalStore } from 'react'
import { productResource } from '../services/purchaseResources.js'

// Shared API snapshot, live TTL/focus/admin invalidation and explicit fallback.
export function useProductIndex() {
  const state = useSyncExternalStore(productResource.subscribe, productResource.getSnapshot, productResource.getSnapshot)
  return { index: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error,
    isFallback: state.source === 'fallback', ready: productResource.isFresh(), refresh: productResource.fresh, source: state.source }
}
