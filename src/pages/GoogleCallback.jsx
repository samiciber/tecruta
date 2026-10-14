import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

// Only a short-lived, one-use code reaches this URL; never a session JWT.
export default function GoogleCallback() {
  const [params] = useSearchParams()
  const { loginWithGoogleCode } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = params.get('code')
    window.history.replaceState(window.history.state, '', window.location.pathname)
    if (!code) {
      setError('No se recibió una sesión válida de Google.')
      return
    }

    loginWithGoogleCode(code).then((result) => {
      if (!result.ok) {
        setError(result.error || 'No se pudo completar el inicio de sesión con Google.')
        return
      }
      toast?.showToast('Sesión iniciada con Google. ¡Bienvenido!', 'success')
      navigate('/', { replace: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="container-tr flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16 text-center">
        <p role="alert" className="text-sm text-ink dark:text-paper">{error}</p>
        <button type="button" onClick={() => navigate('/iniciar-sesion')} className="btn-primary">
          Volver a iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-route border-t-transparent" />
    </div>
  )
}