import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { safePanelReturn } from '../../app/urls.js'

export default function PanelGoogleCallback() {
  const { loginWithGoogleCode } = useAuth()
  const navigate = useNavigate(), ran = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const code = new URLSearchParams(window.location.search).get('code')
    window.history.replaceState(window.history.state, '', window.location.pathname)
    let returnTo = '/'
    try {
      returnTo = safePanelReturn(window.sessionStorage.getItem('tecruta:panel-google-return'))
      window.sessionStorage.removeItem('tecruta:panel-google-return')
    } catch {}
    if (!code) { setError('No se recibió un acceso válido de Google. Inicia nuevamente.'); return }
    loginWithGoogleCode(code, 'panel').then(result => {
      if (result.ok) navigate(returnTo, { replace: true })
      else setError(result.error || 'No se pudo completar el acceso al panel.')
    })
  }, [loginWithGoogleCode, navigate])
  return <div className="mx-auto max-w-lg p-10 text-center">{error ? <><p role="alert" className="mb-4">{error}</p><Link className="btn-primary" to="/iniciar-sesion">Volver a iniciar sesión</Link></> : <p role="status">Comprobando acceso al panel…</p>}</div>
}
