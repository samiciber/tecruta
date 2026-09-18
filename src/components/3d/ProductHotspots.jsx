import React from 'react'
import { Html } from '@react-three/drei'

// Puntos interactivos posicionados en coordenadas 3D (x, y, z) sobre el
// modelo. `hotspots` viene del campo `product.hotspots` (JSON en BD):
// [{ id, x, y, z, title, description }]. Si un producto no trae
// hotspots, Model3DCanvas ni siquiera monta este componente.
export default function ProductHotspots({ hotspots, activeHotspot, onHotspotClick }) {
  return hotspots.map((spot, i) => {
    const id = spot.id ?? i
    const isActive = activeHotspot === id

    return (
      <Html key={id} position={[spot.x, spot.y, spot.z]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onHotspotClick(isActive ? null : id)
            }}
            aria-label={spot.title}
            aria-expanded={isActive}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-card transition-transform ${
              isActive ? 'scale-110 bg-route' : 'bg-route/90 hover:scale-110'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-route/60" style={{ animationDuration: '2.4s' }} />
          </button>

          {isActive && (
            <div className="absolute left-1/2 top-8 w-48 -translate-x-1/2 rounded-xl2 border border-paper-line bg-paper-surface p-3 text-left shadow-card dark:border-night-line dark:bg-night-surface">
              <p className="font-display text-xs font-semibold text-ink dark:text-paper">{spot.title}</p>
              {spot.description && (
                <p className="mt-1 text-[11px] leading-relaxed text-ink-soft dark:text-paper/60">{spot.description}</p>
              )}
            </div>
          )}
        </div>
      </Html>
    )
  })
}
