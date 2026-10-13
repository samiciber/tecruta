import { api } from './api.js'
import { createLiveResource } from './liveResource.js'

import { validateProducts, validatePayments } from '../utils/purchasePolicy.js'

export const productResource = createLiveResource({
  key: 'products', fetcher: signal => api.getProducts({}, { signal }).then(validateProducts),
  fallback: () => import('../data/productIndex.js').then(mod => mod.productIndex),
})
// Never show static transfer destinations while the API is unavailable.
export const paymentResource = createLiveResource({ key: 'payment-methods', fetcher: signal => api.getPaymentMethods({ signal }).then(validatePayments) })
