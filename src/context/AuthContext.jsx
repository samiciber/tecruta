import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api.js'
import { browserStores, readSessionToken, saveSessionToken, clearSessionToken, shouldClearSession } from '../services/sessionStorage.js'
import { readGoogleFlow, clearGoogleFlow } from '../services/googleFlow.js'

export const AuthContext = createContext(null)
const normalize = email => email.trim().toLowerCase()
function toResult(promise, map = () => ({})) {
  return promise.then(data => ({ ok: true, ...map(data) })).catch(error => ({ ok: false, error: error.message, needsVerification: error.needsVerification }))
}
export function AuthProvider({ children }) {
  const storage = useMemo(() => browserStores(window), [])
  const [token, setToken] = useState(() => readSessionToken(storage.local, storage.session))
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(token))
  const [authError, setAuthError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const operation = useRef(0)

  const logout = useCallback(() => {
    operation.current++
    setUser(null); setToken(null); setAuthError(''); setChecking(false)
    clearSessionToken(storage.local, storage.session)
    clearGoogleFlow(storage.session)
  }, [storage])
  useEffect(() => {
    if (!token) { setChecking(false); return }
    let active = true
    setChecking(true); setAuthError('')
    api.auth.me(token).then(({ user: fresh }) => {
      if (active) { setUser(fresh); setAuthError('') }
    }).catch(error => {
      if (!active) return
      if (shouldClearSession(error)) logout()
      else setAuthError('No pudimos comprobar tu sesión. Reintenta sin volver a iniciar sesión.')
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token, refresh, logout])
  const retrySession = useCallback(() => { setAuthError(''); setChecking(true); setRefresh(value => value + 1) }, [])
  const adopt = useCallback((data, remember) => {
    if (!data?.token || !data?.user) throw new Error('No recibimos una sesión completa. Reintenta el acceso.')
    saveSessionToken(storage.local, storage.session, data.token, remember)
    setToken(data.token); setUser(data.user); setAuthError(''); setChecking(false)
  }, [storage])
  const login = useCallback(async ({ email, password, remember = false }) => {
    const current = ++operation.current
    try {
      const data = await api.auth.login({ email, password })
      if (current !== operation.current) return { ok: false, error: 'El acceso fue cancelado.' }
      adopt(data, remember)
      return { ok: true }
    } catch (error) { return { ok: false, error: error.message, needsVerification: error.needsVerification } }
  }, [adopt])
  const loginWithGoogleCode = useCallback(async code => {
    const current = ++operation.current
    const proof = readGoogleFlow(storage.session)
    if (!proof) return { ok: false, error: 'Inicia Google nuevamente desde esta pestaña.' }
    try {
      const data = await api.auth.googleExchange(code, proof.verifier)
      if (current !== operation.current) return { ok: false, error: 'El acceso fue cancelado.' }
      adopt(data, proof.remember)
      clearGoogleFlow(storage.session)
      return { ok: true }
    } catch (error) {
      clearGoogleFlow(storage.session)
      return { ok: false, error: error.message || 'Inicia Google nuevamente.' }
    }
  }, [adopt, storage])
  const register = useCallback(payload => toResult(api.auth.register(payload), data => ({ email: normalize(payload.email), message: data.message })), [])
  const resendCode = useCallback(email => toResult(api.auth.resendCode(email), data => ({ message: data.message })), [])
  const verifyEmail = useCallback((email, code) => toResult(api.auth.verify(email, code)), [])
  const requestPasswordReset = useCallback(email => toResult(api.auth.forgotPassword(email), data => ({ message: data.message })), [])
  const resetPassword = useCallback(async (email, code, newPassword) => {
    const current = operation.current
    const result = await toResult(api.auth.resetPassword(email, code, newPassword))
    if (result.ok && current === operation.current && user?.email && normalize(user.email) === normalize(email)) logout()
    return result
  }, [user, logout])
  const updateProfile = useCallback(async payload => {
    const current = operation.current
    const result = await toResult(api.auth.updateProfile(payload, token), data => ({ user: data.user }))
    if (current !== operation.current) return { ok: false, error: 'La sesión cambió.' }
    if (result.ok) setUser(result.user)
    return result
  }, [token])
  const changePassword = useCallback(async payload => {
    const current = operation.current
    try { await api.auth.changePassword(payload, token); if (current === operation.current) logout(); return { ok: true } }
    catch (error) { if (current === operation.current && shouldClearSession(error)) logout(); return { ok: false, error: error.message } }
  }, [token, logout])
  const logoutAll = useCallback(async () => {
    const current = operation.current
    try { await api.auth.logoutAll(token); if (current === operation.current) logout(); return { ok: true } }
    catch (error) { if (current === operation.current && shouldClearSession(error)) logout(); return { ok: false, error: error.message } }
  }, [token, logout])
  // Hold cart/admin restoration while an initial saved session is unavailable.
  const authLoading = checking || Boolean(token && !user && authError)
  return <AuthContext.Provider value={{ user, token, authLoading, authError, retrySession, isAuthenticated: Boolean(user),
    register, resendCode, verifyEmail, login, loginWithGoogleCode, logout, logoutAll,
    requestPasswordReset, resetPassword, updateProfile, changePassword }}>{children}</AuthContext.Provider>
}
