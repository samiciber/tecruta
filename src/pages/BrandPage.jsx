import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import ProductBrowser from '../components/catalog/ProductBrowser.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useBrands } from '../hooks/useSiteContent.js'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { slugifyText } from '../utils/categoryTree.js'

// /marca/:slug — productos de la marca; estado vacío amable si no tiene.
export default function BrandPage() {
  const { slug } = useParams()
  const { all, loading } = useBrands()
  const { index, loading: loadingProducts } = useProductIndex()
  const brand = all.find((b) => b.slug === slug)
  const products = useMemo(() => index.filter((p) => (p.brandSlug ?? slugifyText(p.brand)) === slug), [index, slug])

  if (loading) return <div role="status" className="container-tr py-24 text-center text-sm text-ink-soft dark:text-paper/60">Cargando marca…</div>
  if (!brand) {
    return (
      <div className="container-tr py-16">
        <EmptyState title="No encontramos esta marca" description="Revisa el listado completo de marcas." action={<Link to="/marcas" className="btn-primary mt-2">Todas las marcas</Link>} />
      </div>
    )
  }

  return (
    <div className="container-tr py-8">
      <nav aria-label="Ruta de navegación" className="mb-4 flex items-center gap-1.5 text-xs text-ink-soft/80 dark:text-paper/60">
        <Link to="/" className="hover:text-route">Inicio</Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <Link to="/marcas" className="hover:text-route">Marcas</Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span aria-current="page" className="text-ink dark:text-paper">{brand.name}</span>
      </nav>
      <div className="mb-6 flex items-center gap-4">
        {brand.logo && <img src={brand.logo} alt="" className="h-12 w-24 object-contain" />}
        <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">{brand.name}</h1>
      </div>

      {!loadingProducts && products.length === 0 ? (
        <EmptyState
          title="Aún no tenemos productos de esta marca"
          description="Estamos ampliando el catálogo. Mientras tanto, mira otras marcas o todo lo disponible."
          action={<div className="mt-2 flex flex-wrap justify-center gap-3"><Link to="/marcas" className="btn-secondary">Otras marcas</Link><Link to="/catalogo" className="btn-primary">Ver catálogo</Link></div>}
        />
      ) : (
        <ProductBrowser products={products} loading={loadingProducts} hideCategories />
      )}
    </div>
  )
}