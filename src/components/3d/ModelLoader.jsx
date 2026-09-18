import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, Center } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

// Tamaño (diámetro aprox.) al que se normaliza CUALQUIER modelo, sin
// importar en qué unidades fue exportado. Sin esto, un modelo exportado
// en metros reales (ej. un teléfono de ~0.15 unidades) se ve como un
// punto diminuto, y como la cámara tiene una distancia mínima fija
// (Model3DCanvas.jsx), no hay forma de acercarse lo suficiente — el
// usuario siente que "el zoom se queda pegado".
const TARGET_SIZE = 2.2

// Carga un .glb/.gltf, lo normaliza a un tamaño consistente y lo centra
// en el origen (Center de drei). `autoRotate` gira suavemente el modelo
// cuando el usuario no lo está arrastrando — se apaga solo si
// prefers-reduced-motion está activo (lo decide el padre, Product3DViewer).
export default function ModelLoader({ url, autoRotate = true }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef(null)

  // Cada instancia usa su propia copia de la escena: si el mismo GLB se
  // reutiliza en varias fichas (ej. variantes de color), evita que
  // transformaciones de una instancia afecten a las demás. También se
  // normaliza la escala en base a su bounding box real (ver TARGET_SIZE).
  const cloned = useRef(null)
  if (!cloned.current) {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    clone.scale.setScalar(TARGET_SIZE / maxDim)
    cloned.current = clone
  }

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25
    }
  })

  useEffect(() => {
    return () => {
      // Libera memoria de geometrías/texturas al desmontar (cambiar de
      // producto, salir de la ficha, etc.) — los modelos GLB pueden
      // pesar varios MB en VRAM si no se limpian.
      cloned.current?.traverse((obj) => {
        obj.geometry?.dispose?.()
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((m) => m.dispose?.())
        }
      })
    }
  }, [])

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={cloned.current} />
      </Center>
    </group>
  )
}
