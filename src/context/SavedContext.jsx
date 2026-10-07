import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readStorage, writeStorage } from '../utils/storage.js'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { AuthContext } from './AuthContext.jsx'
import { api } from '../services/api.js'

export const SavedContext = createContext(null)

const STORAGE_KEY = 'tecruta:saved'
const clean = (list) => (Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string'))] : [])

// Elementos guardados. Mismo patrón que el carrito: invitado → localStorage;
// con sesión → BD (la fuente de verdad), y al iniciar sesión la lista del
// invitado se FUSIONA con la de la cuenta. Solo se guardan ids: nombre,
// precio y stock se resuelven en vivo con el catálogo.
export function SavedProvider({ children }) {
  const [ids, setIds] = useState(() => clean(readStorage(STORAGE_KEY, [])))
  const toast = useContext(ToastContext)
  const navigate = useNavigate()
  const { index: products } = useProductIndex()
  const auth = useContext(AuthContext)
  const user = auth?.user ?? null
  const token = auth?.token ?? null
  const authLoading = auth?.authLoading ?? false

  useEffect(() => {
    if (!user) writeStorage(STORAGE_KEY, ids)
  }, [ids, user])

  const prevUserId = useRef(undefined)
  useEffect(() => {
    if (authLoading) return
    const current = user?.id || null
    const previous = prevUserId.current
    const justLoggedIn = (previous === undefined && current) || (!previous && current)
    const justLoggedOut = previous && !current
    if (justLoggedIn) {
      const guest = clean(readStorage(STORAGE_KEY, []))
      const load = guest.length > 0 ? api.saved.merge(guest, token) : api.saved.get(token)
      load
        .then((data) => {
          setIds(clean(data.productIds))
          writeStorage(STORAGE_KEY, [])
        })
        .catch((err) => console.warn('No se pudo cargar tus elementos guardados, se mantiene la lista local:', err.message))
    } else if (justLoggedOut) {
      setIds([])
    }
    prevUserId.current = current
  }, [user, authLoading, token])

  const items = useMemo(() => ids.map((id) => products.find((p) => p.id === id)).filter(Boolean), [ids, products])
  const isSaved = useCallback((id) => ids.includes(id), [ids])

  const sync = useCallback(
    (promise) => promise.then((d) => setIds(clean(d.productIds))).catch((err) => console.warn('No se pudo sincronizar los guardados:', err.message)),
    [],
  )

  const save = useCallback(
    (product, { silent = false } = {}) => {
      setIds((prev) => (prev.includes(product.id) ? prev : [product.id, ...prev]))
      if (user) sync(api.saved.add(product.id, token))
      if (!silent) {
        toast?.showToast('Guardado para después', 'success', { actionLabel: 'Ver guardados', onAction: () => navigate('/elementos-guardados') })
      }
    },
    [user, token, sync, toast, navigate],
  )

  const remove = useCallback(
    (productId) => {
      setIds((prev) => prev.filter((id) => id !== productId))
      if (user) sync(api.saved.remove(productId, token))
    },
    [user, token, sync],
  )

  const toggle = useCallback((product) => (ids.includes(product.id) ? remove(product.id) : save(product)), [ids, remove, save])

  return <SavedContext.Provider value={{ items, ids, count: items.length, isSaved, save, remove, toggle }}>{children}</SavedContext.Provider>
}