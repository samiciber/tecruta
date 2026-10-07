import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import ProductBrowser from '../components/catalog/ProductBrowser.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { api } from '../services/api.js'
import { useCachedResource } from '../hooks/useCachedResource.js'
import { useCategories } from '../hooks/useCategories.js'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { descendantSlugs, findNode, pathTo } from '../utils/categoryTree.js'

const isExternal = (h) => /^https?:\/\//.test(h || '')

function Tile({ tile }) {
  const inner = (
    <>
      <span className="block aspect-[4/3] w-full overflow-hidden rounded-xl2 bg-route-soft dark:bg-route-softDark">
        {tile.image && <img src={tile.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
      </span>
      <span className="mt-2 block text-center text-sm font-semibold text-ink group-hover:text-route dark:text-paper">{tile.title}</span>
    </>
  )
  if (!tile.href) return <div className="group">{inner}</div>
  return isExternal(tile.href) ? (
    <a href={tile.href} target="_blank" rel="noopener noreferrer" className="group block">{inner}</a>
  ) : (
    <Link to={tile.href} className="group block">{inner}</Link>
  )
}

// /categoria/:slug — tiles de referencia (editables en el admin), subcategorías
// y, debajo, los productos asignados a la rama con los filtros del catálogo.
export default function CategoryPage() {
  const { slug } = useParams()
  const { data: detail, loading, error } = useCachedResource(`category:${slug}`, () => api.getCategoryDetail(slug), { ttl: 30_000 })
  const { tree } = useCategories()
  const { index, loading: loadingProducts } = useProductIndex()

  const node = useMemo(() => findNode(tree, slug), [tree, slug])
  const crumbs = useMemo(() => pathTo(tree, slug) ?? [], [tree, slug])
  const products = useMemo(() => {
    const set = new Set(descendantSlugs(node))
    return index.filter((p) => set.has(p.category))
  }, [index, node])

  if (loading && !detail) return <div role="status" className="container-tr py-24 text-center text-sm text-ink-soft dark:text-paper/60">Cargando categoría…</div>
  if (!detail || error) {
    return (
      <div className="container-tr py-16">
        <EmptyState title="No encontramos esta categoría" description="Puede que haya cambiado de lugar o ya no esté disponible." action={<Link to="/catalogo" className="btn-primary mt-2">Ver todo el catálogo</Link>} />
      </div>
    )
  }

  return (
    <div className="container-tr py-8">
      <nav aria-label="Ruta de navegación" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft/80 dark:text-paper/60">
        <Link to="/" className="hover:text-route">Inicio</Link>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.slug}>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            {i === crumbs.length - 1 ? <span aria-current="page" className="text-ink dark:text-paper">{c.name}</span> : <Link to={`/categoria/${c.slug}`} className="hover:text-route">{c.name}</Link>}
          </React.Fragment>
        ))}
      </nav>

      <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">{detail.name}</h1>
      {detail.description && <p className="mt-1 text-sm text-ink-soft dark:text-paper/60">{detail.description}</p>}

      {detail.tiles?.length > 0 && (
        <ul aria-label="Explora" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {detail.tiles.map((t) => <li key={t.id}><Tile tile={t} /></li>)}
        </ul>
      )}

      {detail.children?.length > 0 && (
        <ul aria-label="Subcategorías" className="mt-6 flex flex-wrap gap-2">
          {detail.children.map((c) => (
            <li key={c.id}>
              <Link to={`/categoria/${c.slug}`} className="inline-block rounded-full border border-paper-line px-4 py-2 text-sm hover:border-route hover:text-route dark:border-night-line">{c.name}</Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        {!loadingProducts && products.length === 0 ? (
          <EmptyState title="Aún no tenemos productos en esta categoría" description="Estamos sumando novedades. Mientras tanto, explora todo el catálogo." action={<Link to="/catalogo" className="btn-primary mt-2">Ver todos los productos</Link>} />
        ) : (
          <ProductBrowser products={products} loading={loadingProducts} />
        )}
      </div>
    </div>
  )
}