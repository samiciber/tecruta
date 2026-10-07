import React from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'

// Destino genérico de menús y enlaces que aún no tienen página asignada.
// Cada ítem de menú puede apuntar a otro destino desde el admin.
export default function Proximamente({ title = 'Próximamente', message = 'Estamos preparando esta sección. Vuelve pronto.' }) {
  return (
    <section className="container-tr flex min-h-[50vh] flex-col items-center justify-center py-16 text-center" aria-labelledby="soon-title">
      <Clock className="mb-4 h-10 w-10 text-header dark:text-sky-300" aria-hidden="true" />
      <h1 id="soon-title" className="font-display text-3xl font-bold text-ink dark:text-paper">{title}</h1>
      <p className="mt-3 max-w-md text-ink-soft dark:text-paper/70">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/catalogo" className="btn-primary">Ver catálogo</Link>
        <Link to="/" className="btn-secondary">Ir al inicio</Link>
      </div>
    </section>
  )
}