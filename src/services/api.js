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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
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

  return data
}

export const api = {
  getProducts: (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    const query = new URLSearchParams(entries).toString()
    return request(`/api/products${query ? `?${query}` : ''}`)
  },
  getProductBySlug: (slug) => request(`/api/products/${encodeURIComponent(slug)}`),
  getCategories: () => request('/api/categories'),
  getPaymentMethods: () => request('/api/payment-methods'),

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
  },
}