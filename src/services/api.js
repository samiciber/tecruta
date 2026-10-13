// Cliente HTTP hacia la API de TecRuta (carpeta server/).
//
// Para el catálogo (getProducts/getProductBySlug/getCategories): si la
// API no responde, quien llame debe atrapar el error — los hooks que las
// usan (useProductIndex, ProductDetail) ya caen de vuelta a los datos
// estáticos empaquetados en el frontend, así la tienda nunca deja de
// funcionar por esto.
//
// Para auth (login/registro/etc.): no hay datos estáticos de respaldo
// posibles (es información real de cuentas), así que si la API no
// responde, el error simplemente se propaga y AuthContext lo muestra
// como mensaje de error al usuario.

import { invalidateLiveResources, invalidatedResourcesFor } from './liveResource.js'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, { method = 'GET', body, token, signal, cache } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    signal,
    cache,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const error = new Error(data?.error || `API respondió ${res.status} en ${path}`)
    error.status = res.status
    error.needsVerification = data?.needsVerification
    throw error
  }

  for (const key of invalidatedResourcesFor(method, path)) invalidateLiveResources(key)
  return data
}

export const api = {
  getProducts: (params = {}, options = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    const query = new URLSearchParams(entries).toString()
    return request(`/api/products${query ? `?${query}` : ''}`, options)
  },
  getProductBySlug: (slug) => request(`/api/products/${encodeURIComponent(slug)}`),
  getCategories: () => request('/api/categories'),
  getPaymentMethods: (options = {}) => request('/api/payment-methods', options),

  // --- Contenido de navegación (Bloque 1) ---
  getNav: () => request('/api/nav'),
  getBrands: () => request('/api/brands'),
  getPopularSearches: () => request('/api/popular-searches'),
  getStores: () => request('/api/stores'),
  getSiteSettings: () => request('/api/site-settings'),
  getCategoryTree: () => request('/api/categories/tree'),
  getCategoryDetail: (slug) => request(`/api/categories/${encodeURIComponent(slug)}`),

  auth: {
    register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
    resendCode: (email) => request('/api/auth/resend-code', { method: 'POST', body: { email } }),
    verify: (email, code) => request('/api/auth/verify', { method: 'POST', body: { email, code } }),
    login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
    me: (token) => request('/api/auth/me', { token }),
    updateProfile: (payload, token) => request('/api/auth/me', { method: 'PATCH', body: payload, token }),
    changePassword: (payload, token) => request('/api/auth/change-password', { method: 'POST', body: payload, token }),
    forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: (email, code, newPassword) =>
      request('/api/auth/reset-password', { method: 'POST', body: { email, code, newPassword } }),
  },

  orders: {
    // Se llama en paralelo al envío por WhatsApp — nunca debe bloquear
    // esa acción. Quien la llama (Checkout.jsx) debe atrapar el error.
    create: (payload, token) => request('/api/orders', { method: 'POST', body: payload, token }),
    mine: (token) => request('/api/orders/me', { token }),
    // Sube el comprobante de pago (imagen o PDF, como data URL en base64)
    // y lo guarda en el pedido. Endpoint público — no lleva token: lo usa
    // tanto el checkout de invitado como el panel admin para reemplazar
    // el comprobante manualmente.
    uploadReceipt: (orderId, fileDataUrl) =>
      request(`/api/orders/${encodeURIComponent(orderId)}/receipt`, { method: 'POST', body: { file: fileDataUrl } }),
  },

  // Carrito persistente en servidor — solo para clientes con sesión
  // iniciada (requiere token). Los invitados usan localStorage
  // directamente en CartContext y nunca llaman a esto.
  cart: {
    get: (token) => request('/api/cart', { token }),
    addItem: (productId, quantity, token) =>
      request('/api/cart/items', { method: 'POST', body: { productId, quantity }, token }),
    setQuantity: (productId, quantity, token) =>
      request(`/api/cart/items/${encodeURIComponent(productId)}`, { method: 'PATCH', body: { quantity }, token }),
    removeItem: (productId, token) =>
      request(`/api/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE', token }),
    clear: (token) => request('/api/cart', { method: 'DELETE', token }),
    merge: (items, token) => request('/api/cart/merge', { method: 'POST', body: { items }, token }),
  },

  // Elementos guardados (lista de deseos) — solo clientes con sesión.
  saved: {
    get: (token) => request('/api/saved', { token }),
    add: (productId, token) => request('/api/saved/items', { method: 'POST', body: { productId }, token }),
    remove: (productId, token) => request(`/api/saved/items/${encodeURIComponent(productId)}`, { method: 'DELETE', token }),
    merge: (productIds, token) => request('/api/saved/merge', { method: 'POST', body: { productIds }, token }),
  },

  // Direcciones guardadas — también solo para clientes con sesión.
  addresses: {
    list: (token) => request('/api/addresses', { token }),
    create: (payload, token) => request('/api/addresses', { method: 'POST', body: payload, token }),
    update: (id, payload, token) =>
      request(`/api/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    remove: (id, token) => request(`/api/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
  },

  // Todo esto requiere el token de una cuenta con rol ADMIN (lo rechaza
  // el backend si no lo es). Usado únicamente por el panel /admin.
  admin: {
    createProduct: (payload, token) => request('/api/admin/products', { method: 'POST', body: payload, token }),
    updateProduct: (id, payload, token) =>
      request(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    deleteProduct: (id, token) => request(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
    // `image` debe ser una data URL completa (lo que produce
    // FileReader.readAsDataURL en el navegador), no solo el base64.
    uploadImage: (image, token) => request('/api/admin/uploads', { method: 'POST', body: { image }, token }),
    // Modelo 3D del producto (.glb/.gltf). `file` es la data URL
    // completa; `filename` se usa solo para validar la extensión.
    uploadModel: (file, filename, token) =>
      request('/api/admin/uploads/model', { method: 'POST', body: { file, filename }, token }),

    createCategory: (payload, token) => request('/api/admin/categories', { method: 'POST', body: payload, token }),
    updateCategory: (slug, payload, token) =>
      request(`/api/admin/categories/${encodeURIComponent(slug)}`, { method: 'PATCH', body: payload, token }),

    getPaymentMethods: (token) => request('/api/admin/payment-methods', { token }),
    updatePaymentMethod: (key, payload, token) =>
      request(`/api/admin/payment-methods/${encodeURIComponent(key)}`, { method: 'PATCH', body: payload, token }),

    getOrders: (params = {}, token) => {
      const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
      const query = new URLSearchParams(entries).toString()
      return request(`/api/admin/orders${query ? `?${query}` : ''}`, { token })
    },
    updateOrderStatus: (id, payload, token) =>
      request(`/api/admin/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: payload, token }),

    getUsers: (token) => request('/api/admin/users', { token }),

    // --- Contenido de navegación (Bloque 1). DELETE responde 204 → null. ---
    getDashboard: (token) => request('/api/admin/dashboard', { token }),
    getBrands: (token) => request('/api/admin/brands', { token }),
    createBrand: (payload, token) => request('/api/admin/brands', { method: 'POST', body: payload, token }),
    updateBrand: (id, payload, token) =>
      request(`/api/admin/brands/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    deleteBrand: (id, token) => request(`/api/admin/brands/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

    getPopularSearches: (token) => request('/api/admin/popular-searches', { token }),
    createPopularSearch: (payload, token) => request('/api/admin/popular-searches', { method: 'POST', body: payload, token }),
    updatePopularSearch: (id, payload, token) =>
      request(`/api/admin/popular-searches/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    deletePopularSearch: (id, token) =>
      request(`/api/admin/popular-searches/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

    getStores: (token) => request('/api/admin/stores', { token }),
    createStore: (payload, token) => request('/api/admin/stores', { method: 'POST', body: payload, token }),
    updateStore: (id, payload, token) =>
      request(`/api/admin/stores/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    deleteStore: (id, token) => request(`/api/admin/stores/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

    getSiteSettings: (token) => request('/api/admin/site-settings', { token }),
    saveSiteSetting: (key, value, token) =>
      request(`/api/admin/site-settings/${encodeURIComponent(key)}`, { method: 'PUT', body: value, token }),

    // Usados desde los Bloques 2 y 3 (editor de menús, categorías en árbol, asignación).
    getNavItems: (menu, token) => request(`/api/admin/nav-items${menu ? `?menu=${encodeURIComponent(menu)}` : ''}`, { token }),
    createNavItem: (payload, token) => request('/api/admin/nav-items', { method: 'POST', body: payload, token }),
    updateNavItem: (id, payload, token) =>
      request(`/api/admin/nav-items/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    deleteNavItem: (id, token) => request(`/api/admin/nav-items/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
    reorderNavItems: (items, token) => request('/api/admin/nav-items/reorder', { method: 'PUT', body: { items }, token }),

    getCategoryTree: (token) => request('/api/admin/category-tree', { token }),
    createCategoryNode: (payload, token) => request('/api/admin/category-tree', { method: 'POST', body: payload, token }),
    updateCategoryNode: (id, payload, token) =>
      request(`/api/admin/category-tree/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
    deleteCategoryNode: (id, token) => request(`/api/admin/category-tree/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
    getCategoryTiles: (id, token) => request(`/api/admin/category-tree/${encodeURIComponent(id)}/tiles`, { token }),
    createCategoryTile: (id, payload, token) =>
      request(`/api/admin/category-tree/${encodeURIComponent(id)}/tiles`, { method: 'POST', body: payload, token }),
    updateCategoryTile: (tileId, payload, token) =>
      request(`/api/admin/category-tiles/${encodeURIComponent(tileId)}`, { method: 'PATCH', body: payload, token }),
    deleteCategoryTile: (tileId, token) =>
      request(`/api/admin/category-tiles/${encodeURIComponent(tileId)}`, { method: 'DELETE', token }),
    assignProducts: (payload, token) => request('/api/admin/products/assign', { method: 'POST', body: payload, token }),
  },
}
