import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import ModelLoader from './ModelLoader.jsx'
import ProductHotspots from './ProductHotspots.jsx'

// Todo lo que toca Three.js vive detrás de este componente, que
// Product3DViewer solo importa con React.lazy(). Así, ningún bundle que
// no visite una ficha con modelo 3D paga el costo de Three.js.
export default function Model3DCanvas({ url, hotspots, autoRotate, activeHotspot, onHotspotClick }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      {/* Iluminación neutra de estudio: una luz principal suave + una de
          relleno, sin colores — el producto debe verse con sus colores
          reales, como en una foto de catálogo premium. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />

      <Suspense fallback={null}>
        <ModelLoader url={url} autoRotate={autoRotate} />
        <Environment preset="city" />
        <ContactShadows position={[0, -1.1, 0]} opacity={0.35} scale={6} blur={2.4} far={2} />
      </Suspense>

      {hotspots?.length > 0 && (
        <ProductHotspots hotspots={hotspots} activeHotspot={activeHotspot} onHotspotClick={onHotspotClick} />
      )}

      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={7}
        makeDefault
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  )
}
