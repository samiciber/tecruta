import React from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import AccountShell from '../../components/account/AccountShell.jsx'
import ProductCard from '../../components/product/ProductCard.jsx'
import { useSaved } from '../../hooks/useSaved.js'
import { useAuth } from '../../hooks/useAuth.js'

// /elementos-guardados — funciona también para invitados (localStorage).
export default function SavedItems() {
  const { items } = useSaved()
  const { isAuthenticated } = useAuth()
  return (
    <AccountShell title="Elementos guardados" description={isAuthenticated ? 'Tu lista se guarda en tu cuenta.' : 'Inicia sesión para conservar tu lista en todos tus dispositivos.'}>
      {items.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-paper-line p-10 text-center dark:border-night-line">
          <Heart className="mx-auto h-10 w-10 text-ink-soft dark:text-paper/50" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-ink dark:text-paper">Tu lista está vacía en este momento</h2>
          <p className="mt-1 text-sm text-ink-soft dark:text-paper/70">Toca el corazón en cualquier producto para guardarlo aquí.</p>
          <Link to="/catalogo" className="btn-primary mt-5 inline-flex">Explorar productos</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
        </ul>
      )}
    </AccountShell>
  )
}