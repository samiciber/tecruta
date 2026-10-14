import { useSyncExternalStore } from 'react'
import { paymentResource } from '../services/purchaseResources.js'

export function usePaymentMethods() {
  const state = useSyncExternalStore(paymentResource.subscribe, paymentResource.getSnapshot, paymentResource.getSnapshot)
  const ready = paymentResource.isFresh()
  const methods = ready ? state.data : []
  return { methods, getMethodByKey: key => methods.find(m => m.key === key), ready,
    loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: paymentResource.fresh }
}
