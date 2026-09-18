import React, { createContext, useCallback, useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { readStorage, writeStorage } from '../utils/storage.js'

export const AuthContext = createContext(null)

const TOKEN_KEY = 'tecruta:token'

// Todas las funciones de este contexto devuelven { ok, error?, ... } en
// vez de lanzar excepciones — mismo contrato que tenía la versión anterior
// (simulada en localStorage), para que Login/Register/VerifyEmail/
// ForgotPassword casi no tuvieran que cambiar al conectar la API real.
function toResult(promise, mapSuccess = () => ({})) {
  return promise
    .then((data) => ({ ok: true, ...mapSuccess(data) }))
    .catch((err) => ({ ok: false, error: err.message, needsVerification: err.needsVerification }))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => readStorage(TOKEN_KEY, null))
  // true solo mientras se valida un token guardado de una sesión anterior
  // (para que, por ejemplo, el panel de administración no decida "no eres
  // admin" antes de terminar de restaurar la sesión).
  const [authLoading, setAuthLoading] = useState(() => !!readStorage(TOKEN_KEY, null))

  // Al cargar la app, si hay un token guardado de una sesión anterior,
  // lo valida contra la API y recupera los datos actuales del usuario.
  // Si el token ya no es válido (expiró, o la cuenta cambió), se limpia
  // en silencio y el usuario queda como no autenticado.
  useEffect(() => {
    if (!token) {
      setAuthLoading(false)
      return
    }
    let activo = true
    api.auth
      .me(token)
      .then(({ user: fresh }) => {
        if (activo) setUser(fresh)
      })
      .catch(() => {
        if (activo) {
          setToken(null)
          writeStorage(TOKEN_KEY, null)
        }
      })
      .finally(() => {
        if (activo) setAuthLoading(false)
      })
    return () => {
      activo = false
    }
  }, [token])

  const register = useCallback(
    (payload) => toResult(api.auth.register(payload), (data) => ({ email: data.email, emailSent: data.emailSent })),
    [],
  )

  const resendCode = useCallback(
    (email) => toResult(api.auth.resendCode(email), (data) => ({ emailSent: data.emailSent })),
    [],
  )

  const verifyEmail = useCallback((email, code) => toResult(api.auth.verify(email, code)), [])

  const login = useCallback(async ({ email, password }) => {
    try {
      const data = await api.auth.login({ email, password })
      setToken(data.token)
      writeStorage(TOKEN_KEY, data.token)
      setUser(data.user)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message, needsVerification: err.needsVerification }
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    writeStorage(TOKEN_KEY, null)
  }, [])

  const requestPasswordReset = useCallback(
    (email) => toResult(api.auth.forgotPassword(email), (data) => ({ emailSent: data.emailSent })),
    [],
  )

  const resetPassword = useCallback(
    (email, code, newPassword) => toResult(api.auth.resetPassword(email, code, newPassword)),
    [],
  )

  // Distinto de resetPassword: este es para un cliente que ya tiene
  // sesión iniciada y quiere cambiar su contraseña desde "Mi cuenta"
  // (pide la contraseña actual, no un código por correo).
  const updateProfile = useCallback(
    (payload) => toResult(api.auth.updateProfile(payload, token), (data) => ({ user: data.user })).then((result) => {
      if (result.ok) setUser(result.user)
      return result
    }),
    [token],
  )

  const changePassword = useCallback(
    (payload) => toResult(api.auth.changePassword(payload, token)),
    [token],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authLoading,
        isAuthenticated: !!user,
        register,
        resendCode,
        verifyEmail,
        login,
        logout,
        requestPasswordReset,
        resetPassword,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}