import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readStorage, writeStorage } from '../utils/storage.js'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { AuthContext } from './AuthContext.jsx'
import { api } from '../services/api.js'

export const CartContext = createContext(null)

const STORAGE_KEY = 'tecruta:cart'

// Un item guardado solo conserva { productId, quantity }. Los datos del
// producto (precio, stock, nombre) siempre se resuelven en vivo contra
// el catálogo (useProductIndex), así nunca se confía en precios ni stock
// cacheados en localStorage ni en lo último que devolvió el servidor.
function sanitizeStoredCart(stored) {
  if (!Array.isArray(stored)) return []
  return stored
    .filter((entry) => entry && typeof entry.productId === 'string' && Number.isFinite(entry.quantity))
    .map((entry) => ({ productId: entry.productId, quantity: Math.max(1, Math.floor(entry.quantity)) }))
}

// Calcula el siguiente conjunto de entries al sumar `quantity` unidades
// de un producto (usado tanto para invitados como, de forma optimista,
// para clientes con sesión mientras se confirma con el servidor).
function withAddedQuantity(prevEntries, product, quantity) {
  const existing = prevEntries.find((e) => e.productId === product.id)
  const currentQty = existing ? existing.quantity : 0
  const nextQty = Math.min(currentQty + quantity, product.stock)
  if (existing) {
    return prevEntries.map((e) => (e.productId === product.id ? { ...e, quantity: nextQty } : e))
  }
  return [...prevEntries, { productId: product.id, quantity: nextQty }]
}

export function CartProvider({ children }) {
  const [entries, setEntries] = useState(() => sanitizeStoredCart(readStorage(STORAGE_KEY, [])))
  const toast = useContext(ToastContext)
  const navigate = useNavigate()
  const { index: products } = useProductIndex()

  // Se usa useContext(AuthContext) directamente (no el hook useAuth) para
  // no atar CartProvider a que siempre exista un <AuthProvider> más
  // arriba en el árbol — igual que ya hace este archivo con ToastContext.
  const auth = useContext(AuthContext)
  const user = auth?.user ?? null
  const token = auth?.token ?? null
  const authLoading = auth?.authLoading ?? false

  // Invitados: el carrito vive solo en localStorage, exactamente igual
  // que antes de conectar el carrito persistente. Mientras hay sesión
  // iniciada, no se escribe aquí — el servidor es la fuente de verdad y
  // el localStorage se limpia al fusionar (ver más abajo).
  useEffect(() => {
    if (!user) writeStorage(STORAGE_KEY, entries)
  }, [entries, user])

  // Detecta las transiciones de sesión (invitado → logueado, logueado →
  // invitado) para fusionar o resetear el carrito en consecuencia.
  // prevUserId.current === undefined significa "todavía no sabemos" (se
  // espera a que authLoading termine de restaurar la sesión guardada).
  const prevUserId = useRef(undefined)

  useEffect(() => {
    if (authLoading) return

    const currentUserId = user?.id || null
    const previousUserId = prevUserId.current
    const justLoggedIn = (previousUserId === undefined && currentUserId) || (!previousUserId && currentUserId)
    const justLoggedOut = previousUserId && !currentUserId

    if (justLoggedIn) {
      const guestEntries = sanitizeStoredCart(readStorage(STORAGE_KEY, []))
      const loadCart = guestEntries.length > 0 ? api.cart.merge(guestEntries, token) : api.cart.get(token)

      loadCart
        .then((data) => {
          setEntries(sanitizeStoredCart(data.items))
          // Ya se fusionó (o no había nada que fusionar): el carrito de
          // invitado en este navegador queda vacío, el servidor manda.
          writeStorage(STORAGE_KEY, [])
        })
        .catch((err) => {
          console.warn('No se pudo cargar el carrito del servidor, se mantiene el local:', err.message)
        })
    } else if (justLoggedOut) {
      setEntries([])
    }

    prevUserId.current = currentUserId
  }, [user, authLoading, token])

  const items = useMemo(() => {
    return entries
      .map((entry) => {
        const product = products.find((p) => p.id === entry.productId)
        if (!product) return null
        const quantity = Math.min(entry.quantity, Math.max(product.stock, 0))
        return { ...product, quantity }
      })
      .filter((item) => item && item.quantity > 0)
  }, [entries, products])

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // opts.silent: no muestra la confirmación (p. ej. «Comprar ahora»).
  function addItem(product, quantity = 1, opts = {}) {
    if (product.stock <= 0) return

    setEntries((prev) => withAddedQuantity(prev, product, quantity))

    if (user) {
      api.cart
        .addItem(product.id, quantity, token)
        .then((data) => setEntries(sanitizeStoredCart(data.items)))
        .catch((err) => console.warn('No se pudo sincronizar el carrito con el servidor:', err.message))
    }

    if (!opts.silent) {
      toast?.showToast(`${product.name} se agregó al carrito`, 'success', {
        actionLabel: 'Ir al carrito',
        onAction: () => navigate('/carrito'),
      })
    }
  }

  function removeItem(productId) {
    setEntries((prev) => prev.filter((e) => e.productId !== productId))

    if (user) {
      api.cart
        .removeItem(productId, token)
        .then((data) => setEntries(sanitizeStoredCart(data.items)))
        .catch((err) => console.warn('No se pudo sincronizar el carrito con el servidor:', err.message))
    }
  }

  function updateQuantity(productId, quantity) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    const clamped = Math.min(quantity, Math.max(product.stock, 0))

    setEntries((prev) => prev.map((e) => (e.productId === productId ? { ...e, quantity: clamped } : e)))

    if (user) {
      api.cart
        .setQuantity(productId, clamped, token)
        .then((data) => setEntries(sanitizeStoredCart(data.items)))
        .catch((err) => console.warn('No se pudo sincronizar el carrito con el servidor:', err.message))
    }
  }

  function clearCart() {
    setEntries([])

    if (user) {
      api.cart.clear(token).catch((err) => {
        console.warn('No se pudo vaciar el carrito en el servidor:', err.message)
      })
    }
  }

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}