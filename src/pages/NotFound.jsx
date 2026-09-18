import React from 'react'
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function NotFound() {
  return (
    <div className="container-tr py-20">
      <EmptyState
        icon={Compass}
        title="Página no encontrada"
        description="El enlace que seguiste no existe o fue movido. Vuelve al inicio o explora el catálogo."
        action={
          <div className="mt-2 flex gap-2">
            <Link to="/" className="btn-secondary">Ir al inicio</Link>
            <Link to="/catalogo" className="btn-primary">Ver catálogo</Link>
          </div>
        }
      />
    </div>
  )
}
