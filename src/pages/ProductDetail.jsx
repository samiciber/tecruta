import ExpandableDescription from '../components/product/ExpandableDescription.jsx'
import React, { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ShoppingCart, Zap, ChevronRight, Truck, ShieldCheck, MessageCircle, Box, Images } from 'lucide-react'
import StockBadge from '../components/product/StockBadge.jsx'
import SaveButton from '../components/product/SaveButton.jsx'
import QuantitySelector from '../components/product/QuantitySelector.jsx'
import ProductCard from '../components/product/ProductCard.jsx'
import Product3DViewer from '../components/3d/Product3DViewer.jsx'
import Reveal from '../components/animations/Reveal.jsx'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { useCategories } from '../hooks/useCategories.js'
import { api } from '../services/api.js'
import { formatCurrency, calculateDiscountPercent } from '../utils/formatCurrency.js'
import { useCart } from '../hooks/useCart.js'

// Mismas promesas reales que ya se muestran en TrustSection.jsx (home) —
// se repiten aquí, resumidas, como el paso "Beneficios" que pide la
// jerarquía de la ficha. No son texto nuevo inventado para esta página.
const BENEFITS = [
  { icon: Truck, label: 'Envíos a todo Perú' },
  { icon: ShieldCheck, label: 'Pago seguro' },
  { icon: MessageCircle, label: 'Atención personalizada' },
]

export default function ProductDetail() {
  const { slug } = useParams()
  const { index, loading: loadingIndex } = useProductIndex()
  const { getCategoryBySlug } = useCategories()
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  // '3d' | 'photos' — solo relevante si el producto trae modelo 3D; si no,
  // siempre se usa la galería de fotos normal.
  const [viewMode, setViewMode] = useState('photos')
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loadingProducto, setLoadingProducto] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (loadingIndex) return
    const entrada = index.find((p) => p.slug === slug)
    if (!entrada) {
      setNotFound(true)
      setLoadingProducto(false)
      return
    }
    setLoadingProducto(true)

    // Los "relacionados" ya se pueden armar con el índice liviano que
    // llegó de useProductIndex (misma fuente que usa el catálogo) — no
    // hace falta esperar el detalle completo del producto para esto.
    const relacionados = index.filter((p) => p.category === entrada.category && p.id !== entrada.id).slice(0, 4)

    api
      .getProductBySlug(slug)
      .catch(async (err) => {
        console.warn('No se pudo obtener el producto de la API, usando datos locales:', err.message)
        const mod = await import(`../data/products/${entrada.category}.js`)
        return mod.productos.find((p) => p.slug === slug)
      })
      .then((completo) => {
        setProduct(completo || null)
        setRelated(relacionados)
        setActiveImage(0)
        setViewMode(completo?.enable3D && completo?.model3DUrl ? '3d' : 'photos')
        setLoadingProducto(false)
      })
  }, [slug, index, loadingIndex])

  if (loadingIndex || loadingProducto || !product) {
    return <div className="container-tr py-24 text-center text-sm text-ink-soft dark:text-paper/60">Cargando producto…</div>
  }

  const category = getCategoryBySlug(product.category)
  const discount = calculateDiscountPercent(product.price, product.compareAtPrice)
  const outOfStock = product.stock <= 0

  return (
    <div className="container-tr py-8">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-ink-soft/70 dark:text-paper/50" aria-label="Ruta de navegación">
        <Link to="/" className="hover:text-route">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to={`/catalogo?categoria=${product.category}`} className="hover:text-route">{category?.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-ink dark:text-paper">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          {product.enable3D && product.model3DUrl && (
            <div className="mb-3 inline-flex rounded-full border border-paper-line p-1 dark:border-night-line" role="tablist" aria-label="Vista del producto">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === '3d'}
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === '3d' ? 'bg-route-soft text-route dark:bg-route-softDark' : 'text-ink-soft hover:text-ink dark:text-paper/60 dark:hover:text-paper'
                }`}
              >
                <Box className="h-3.5 w-3.5" /> Ver en 3D
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'photos'}
                onClick={() => setViewMode('photos')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'photos' ? 'bg-route-soft text-route dark:bg-route-softDark' : 'text-ink-soft hover:text-ink dark:text-paper/60 dark:hover:text-paper'
                }`}
              >
                <Images className="h-3.5 w-3.5" /> Fotos
              </button>
            </div>
          )}

          {viewMode === '3d' && product.enable3D && product.model3DUrl ? (
            <div className="aspect-square overflow-hidden rounded-xl2 bg-route-soft dark:bg-route-softDark">
              <Product3DViewer
                modelUrl={product.model3DUrl}
                posterUrl={product.model3DPoster || product.images[0]}
                alt={product.name}
                hotspots={Array.isArray(product.hotspots) ? product.hotspots : []}
                onFallback={() => setViewMode('photos')}
              />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl2 bg-route-soft dark:bg-route-softDark">
                {/* Sin aspect-square y SIN max-height en px: el contenedor
                    no fuerza ningún cuadro fijo. w-full + h-auto (sin
                    object-contain, no hace falta) deja que la altura se
                    calcule 100% a partir de la proporción real de la
                    imagen — así nunca se angosta ni sobra espacio a los
                    costados. max-h-[85vh] es solo un techo de seguridad
                    relativo al alto de PANTALLA (no un px fijo) para el
                    caso extremo de un banner desproporcionadamente alto;
                    si algún producto real lo llega a disparar, avisar
                    antes de tocar esto de nuevo — ver conversación. */}
                <img src={product.images[activeImage]} alt={product.name} className="h-auto max-h-[85vh] w-full" />
              </div>
              {product.images.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Ver imagen ${i + 1} de ${product.name}`}
                      className={`h-16 w-16 overflow-hidden rounded-lg border-2 bg-route-soft transition-colors dark:bg-route-softDark ${activeImage === i ? 'border-route' : 'border-transparent'}`}
                    >
                      <img src={img} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-sm font-medium uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">{product.brand}</span>
          <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">{product.name}</h1>
          <p className="text-sm text-ink-soft dark:text-paper/60">{product.shortDescription}</p>

          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-ink dark:text-paper">{formatCurrency(product.price)}</span>
            {product.compareAtPrice && (
              <>
                <span className="font-mono text-sm text-ink-soft/60 line-through dark:text-paper/40">{formatCurrency(product.compareAtPrice)}</span>
                <span className="rounded-full bg-signal-red/10 px-2 py-0.5 text-xs font-semibold text-signal-red">-{discount}%</span>
              </>
            )}
          </div>

          <StockBadge stock={product.stock} className="w-fit" />

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-paper-line py-3 dark:border-night-line">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-paper/60">
                <Icon className="h-3.5 w-3.5 text-route" />
                {label}
              </span>
            ))}
          </div>

          {!outOfStock && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft dark:text-paper/60">Cantidad</span>
              <QuantitySelector quantity={quantity} max={product.stock} onChange={setQuantity} />
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={outOfStock} onClick={() => addItem(product, quantity)} className="btn-primary flex-1">
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? 'Sin stock' : 'Agregar al carrito'}
            </button>
            <Link
              to="/checkout"
              onClick={() => !outOfStock && addItem(product, quantity, { silent: true })}
              className={`btn-secondary flex-1 ${outOfStock ? 'pointer-events-none opacity-40' : ''}`}
              aria-disabled={outOfStock}
            >
              <Zap className="h-4 w-4" />
              Comprar ahora
            </Link>
            <SaveButton product={product} variant="button" className="flex-1" />
          </div>

          <div className="mt-2 rounded-xl2 border border-paper-line p-4 dark:border-night-line">
            <h2 className="mb-3 font-display text-sm font-semibold text-ink dark:text-paper">Descripción</h2>
            <ExpandableDescription description={product.description} />
          </div>

          {product.specifications?.length > 0 && (
            <div className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink dark:text-paper">Especificaciones</h2>
              <dl className="space-y-2 text-sm">
                {product.specifications.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4 border-b border-paper-line/60 pb-2 last:border-0 last:pb-0 dark:border-night-line/60">
                    <dt className="text-ink-soft dark:text-paper/50">{spec.label}</dt>
                    <dd className="text-right font-medium text-ink dark:text-paper">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <Reveal as="section" className="mt-16">
          <h2 className="mb-6 font-display text-xl font-bold text-ink dark:text-paper">También te puede interesar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  )
}