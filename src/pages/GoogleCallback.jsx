import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ToastContext } from '../components/ui/ToastProvider.jsx'
import { useAuth } from '../hooks/useAuth.js'

// Destino de GET /api/auth/google/callback en el backend una vez que ya
// procesó el intercambio con Google: llega aquí con ?token=... (éxito) o
// se redirige directo a /iniciar-sesion?googleError=... (falla), por lo
// que esta página solo necesita manejar el caso de éxito.
export default function GoogleCallback() {
  const [params] = useSearchParams()
  const { loginWithGoogleToken } = useAuth()
  const toast = useContext(ToastContext)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const token = params.get('token')
    if (!token) {
      setError('No se recibió una sesión válida de Google.')
      return
    }

    loginWithGoogleToken(token).then((result) => {
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
        <p className="text-sm text-signal-red">{error}</p>
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