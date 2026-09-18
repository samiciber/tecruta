import React, { Suspense, lazy, useState } from 'react'
import { RotateCw, Loader2 } from 'lucide-react'
import { use3DSupport } from './use3DSupport.js'
import Model3DErrorBoundary from './Model3DErrorBoundary.jsx'

// Three.js + @react-three/fiber + @react-three/drei SOLO se descargan si
// este componente realmente llega a montar Model3DCanvas — es decir,
// solo cuando el producto tiene modelo 3D Y el dispositivo lo soporta.
// Cualquier otra ficha de producto (la gran mayoría, al no tener
// model3DUrl) nunca paga este costo de bundle.
const Model3DCanvas = lazy(() => import('./Model3DCanvas.jsx'))

function ViewerLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-route" />
    </div>
  )
}

// Truco simple para saber cuándo el Suspense terminó de resolver (el
// modelo ya bajó y está en escena): este componente se monta recién
// cuando React deja de suspender su árbol, así que su propio efecto de
// montaje es la señal de "listo".
function ModelReadyDetector({ onReady, children }) {
  React.useEffect(() => {
    onReady()
  }, [onReady])
  return children
}

/**
 * Visor 3D reutilizable para fichas de producto.
 *
 * Props:
 * - modelUrl: string | null|undefined — URL del .glb/.gltf. Si falta,
 *   este componente no debería montarse (la decisión "imagen vs 3D" la
 *   toma el padre, ver ProductDetail.jsx), pero por seguridad también
 *   hace el fallback aquí si se lo llama sin URL.
 * - posterUrl: string — imagen que se muestra fija mientras carga el
 *   3D, y como fallback final si el modelo falla o el dispositivo no
 *   tiene soporte.
 * - alt: string — texto alternativo para el poster.
 * - hotspots: Array<{id,x,y,z,title,description}> | undefined
 * - onFallback: () => void — opcional, se llama si el 3D no pudo
 *   mostrarse por cualquier motivo (sin soporte, error de carga), para
 *   que el padre pueda reaccionar (ej. ocultar el toggle "Ver en 3D").
 */
export default function Product3DViewer({ modelUrl, posterUrl, alt = '', hotspots = [], onFallback }) {
  const { ready, supported, reducedMotion } = use3DSupport()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activeHotspot, setActiveHotspot] = useState(null)

  const handleError = () => {
    setFailed(true)
    onFallback?.()
  }

  const shouldRender3D = Boolean(modelUrl) && ready && supported && !failed

  if (!shouldRender3D) {
    // Sin soporte, sin URL, o el modelo falló: la ficha sigue
    // funcionando perfectamente con la imagen normal. Este es el estado
    // por defecto para el 99% de los productos hoy (ninguno tiene
    // model3DUrl todavía).
    return posterUrl ? (
      <img src={posterUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    ) : null
  }

  return (
    <div className="relative h-full w-full">
      {/* Poster de fondo mientras el modelo termina de cargar — evita un
          hueco vacío o un spinner sobre fondo liso. */}
      {posterUrl && !loaded && (
        <img src={posterUrl} alt={alt} className="absolute inset-0 h-full w-full object-cover opacity-60" />
      )}

      <Model3DErrorBoundary onError={handleError}>
        <Suspense fallback={<ViewerLoading />}>
          <div className={`h-full w-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
            <ModelReadyDetector onReady={() => setLoaded(true)}>
              <Model3DCanvas
                url={modelUrl}
                hotspots={hotspots}
                autoRotate={!reducedMotion}
                activeHotspot={activeHotspot}
                onHotspotClick={setActiveHotspot}
              />
            </ModelReadyDetector>
          </div>
        </Suspense>
      </Model3DErrorBoundary>

      <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm dark:bg-black/60">
        <RotateCw className="h-3 w-3" />
        Arrastra para girar
      </span>
    </div>
  )
}
