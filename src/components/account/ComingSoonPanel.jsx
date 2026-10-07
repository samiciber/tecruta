import React from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'

// Estado vacío «Próximamente» con la estructura final de la sección.
export default function ComingSoonPanel({ icon: Icon = Clock, heading, text, features = [] }) {
  return (
    <div className="rounded-xl2 border border-paper-line p-8 text-center dark:border-night-line">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-header/10 text-header dark:text-sky-300">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-4 inline-block rounded-full bg-cta px-3 py-0.5 text-xs font-bold text-ink">Próximamente</p>
      <h2 className="mt-3 text-lg font-bold text-ink dark:text-paper">{heading}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft dark:text-paper/70">{text}</p>
      {features.length > 0 && (
        <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-sm text-ink dark:text-paper">
          {features.map((f) => <li key={f} className="flex gap-2"><span aria-hidden="true">•</span>{f}</li>)}
        </ul>
      )}
      <Link to="/catalogo" className="btn-secondary mt-6 inline-flex">Seguir comprando</Link>
    </div>
  )
}