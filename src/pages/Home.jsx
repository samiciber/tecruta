import React from 'react'
import { Link } from 'react-router-dom'
import { useHome } from '../hooks/useHome.js'
import { HomeView } from '../components/home/HomeView.jsx'
export { HomeView } from '../components/home/HomeView.jsx'

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando contenido de inicio">
      <div className="h-[320px] animate-pulse bg-gradient-to-br from-header to-route-dark sm:h-[420px]" />
      <div className="container-tr space-y-5 py-8">
        <div className="h-8 w-56 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
        <div className="h-28 animate-pulse rounded-xl2 bg-gray-100 dark:bg-white/5" />
      </div>
    </div>
  )
}

export default function Home() {
  const { data, loading, error, refresh } = useHome()

  if (loading && !data) return <HomeSkeleton />
  if (!data) {
    return (
      <section className="container-tr py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-ink dark:text-paper">No pudimos cargar el inicio</h1>
        <p role="alert" className="mt-2 text-sm text-ink-soft dark:text-paper/70">{error?.message || 'La API no devolvió contenido.'}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={refresh} className="btn-primary px-5 py-2.5">Reintentar</button>
          <Link to="/catalogo" className="btn-secondary px-5 py-2.5">Explorar catálogo</Link>
        </div>
      </section>
    )
  }

  return <HomeView data={data} error={error} refresh={refresh} />
}
