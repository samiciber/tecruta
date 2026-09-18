import { useEffect, useState } from 'react'

// Detecta si el dispositivo/navegador actual puede manejar el visor 3D
// con una experiencia decente. Se usa ANTES de cargar Three.js — si esto
// devuelve `false`, Product3DViewer ni siquiera intenta el import
// dinámico del bundle 3D, así que un dispositivo sin soporte no paga
// ningún costo de red ni de CPU por código que nunca va a usar.
function detectWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

function detectLowEndDevice() {
  // Heurística conservadora: si el navegador expone estas APIs y los
  // valores son claramente bajos, tratamos el dispositivo como de gama
  // baja. Si no expone la info (Safari, la mayoría de iOS), asumimos
  // que SÍ hay soporte — preferimos no negarle 3D a alguien por falta
  // de datos, ya que el fallback a imagen normal siempre es seguro de
  // todas formas si algo sale mal.
  const cores = navigator.hardwareConcurrency
  const memory = navigator.deviceMemory // no estándar, solo Chromium
  if (typeof cores === 'number' && cores <= 2) return true
  if (typeof memory === 'number' && memory <= 2) return true
  return false
}

export function use3DSupport() {
  const [state, setState] = useState({ ready: false, supported: false, reducedMotion: false })

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
    const webgl = detectWebGL()
    const lowEnd = detectLowEndDevice()

    // El 3D sigue "soportado" aunque el usuario prefiera menos
    // movimiento — Product3DViewer lo usa para decidir si autorota o
    // deja el modelo estático, no para desactivar el visor entero (ver
    // sección de accesibilidad del informe).
    setState({ ready: true, supported: webgl && !lowEnd, reducedMotion })
  }, [])

  return state
}
