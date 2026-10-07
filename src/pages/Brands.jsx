import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBrands } from '../hooks/useSiteContent.js'

const LETTERS = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
const letterOf = (name) => {
  const c = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '0-9'
}

function BrandLink({ brand }) {
  return (
    <Link to={`/marca/${brand.slug}`} className="hover:text-route hover:underline">
      {brand.name}
    </Link>
  )
}

// /marcas — destacadas arriba y listado completo A–Z con índice de letras.
export default function Brands() {
  const { featured, all, loading, error } = useBrands()
  const groups = useMemo(() => {
    const map = new Map()
    for (const b of all) {
      const l = letterOf(b.name)
      if (!map.has(l)) map.set(l, [])
      map.get(l).push(b)
    }
    return map
  }, [all])

  return (
    <div className="container-tr py-8">
      <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Todas las marcas</h1>
      {loading && <p role="status" className="mt-4 text-sm text-ink-soft dark:text-paper/60">Cargando marcas…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-signal-red">No pudimos cargar las marcas. Intenta de nuevo en un momento.</p>}

      {featured.length > 0 && (
        <section aria-labelledby="featured-brands" className="mt-6">
          <h2 id="featured-brands" className="mb-3 text-lg font-bold text-ink dark:text-paper">Marcas destacadas</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {featured.map((b) => (
              <li key={b.id}>
                <Link to={`/marca/${b.slug}`} className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl2 border border-paper-line p-3 text-center hover:border-route dark:border-night-line">
                  {b.logo ? <img src={b.logo} alt="" className="max-h-10 object-contain" /> : null}
                  <span className="text-sm font-semibold text-ink dark:text-paper">{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {all.length > 0 && (
        <section aria-labelledby="az-brands" className="mt-10">
          <h2 id="az-brands" className="mb-3 text-lg font-bold text-ink dark:text-paper">Todas las marcas A–Z</h2>
          <nav aria-label="Ir a la letra" className="sticky top-[7.5rem] z-10 -mx-1 mb-6 flex flex-wrap gap-1 bg-paper/95 px-1 py-2 backdrop-blur dark:bg-night/95">
            {LETTERS.map((l) =>
              groups.has(l) ? (
                <a key={l} href={`#letra-${l}`} className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-paper-line px-2 text-sm font-semibold text-header hover:bg-header hover:text-white dark:border-night-line dark:text-sky-300">{l}</a>
              ) : (
                <span key={l} aria-hidden="true" className="flex h-8 min-w-[2rem] items-center justify-center px-2 text-sm text-ink-soft/30 dark:text-paper/20">{l}</span>
              ),
            )}
          </nav>
          <div className="space-y-8">
            {LETTERS.filter((l) => groups.has(l)).map((l) => (
              <div key={l} id={`letra-${l}`} className="scroll-mt-48">
                <h3 className="mb-2 border-b border-paper-line pb-1 text-xl font-bold text-ink dark:border-night-line dark:text-paper">{l}</h3>
                <ul className="columns-2 gap-6 text-sm text-ink-soft dark:text-paper/80 sm:columns-3 lg:columns-4">
                  {groups.get(l).map((b) => <li key={b.id} className="mb-1.5 break-inside-avoid"><BrandLink brand={b} /></li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}