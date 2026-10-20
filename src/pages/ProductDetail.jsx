import ProductReviews from '../components/product/ProductReviews.jsx'
import Rating from '../components/product/Rating.jsx'
import { optimizeImage } from '../utils/imageUrl.js'
import { useSiteSettings } from '../hooks/useSiteContent.js'
import ExpandableDescription from '../components/product/ExpandableDescription.jsx'
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShoppingCart, Zap, ChevronRight, Box, Images } from 'lucide-react'
import StockBadge from '../components/product/StockBadge.jsx'
import SaveButton from '../components/product/SaveButton.jsx'
import QuantitySelector from '../components/product/QuantitySelector.jsx'
import ProductCard from '../components/product/ProductCard.jsx'
import Product3DViewer from '../components/3d/Product3DViewer.jsx'
import Reveal from '../components/animations/Reveal.jsx'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { useCategories } from '../hooks/useCategories.js'
import { resolveCatalogDetail } from '../services/catalogDetail.js'
import { formatCurrency, calculateDiscountPercent } from '../utils/formatCurrency.js'
import { useCart } from '../hooks/useCart.js'
import { api } from '../services/api.js'
import ProductShare from '../components/product/ProductShare.jsx'
import { breadcrumbStructuredData, safeJsonLd } from '../utils/seo.js'
import { STORE_ORIGIN } from '../app/urls.js'

const ImageZoom = lazy(() => import('../components/product/ImageZoom.jsx'))

export default function ProductDetail() {
  const { slug } = useParams()
  const { settings } = useSiteSettings()
  const benefits = settings.storeBusiness?.benefits || []
  const { index, loading: loadingIndex, source } = useProductIndex()
  const { getCategoryBySlug } = useCategories()
  const { addItem, canAdd } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  // '3d' | 'photos' — solo relevante si el producto trae modelo 3D; si no,
  // siempre se usa la galería de fotos normal.
  const [viewMode, setViewMode] = useState('photos')
  const [detail, setDetail] = useState({ slug, status: 'loading' })
  const [retry, setRetry] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const viewedProduct = useRef(null)

  useEffect(() => {
    if (loadingIndex) return
    let active = true
    const entry = index.find((p) => p.slug === slug)
    setDetail({ slug, status: 'loading' })
    resolveCatalogDetail({
      entry,
      source,
      fetchProduct: api.getProductBySlug,
      loadFallback: category => import(`../data/products/${category}.js`).then(mod => mod.productos),
    }).then((result) => {
      if (!active) return
      const identity = result.status === 'ready' ? `${slug}:${result.product.id}` : null
      if (identity && viewedProduct.current !== identity) {
        viewedProduct.current = identity
        setQuantity(1)
        setZoomOpen(false)
        setActiveImage(0)
        setViewMode(result.product.enable3D && result.product.model3DUrl ? '3d' : 'photos')
      }
      setDetail({ slug, ...result })
    })
    return () => { active = false }
  }, [slug, index, loadingIndex, source, retry])

  const current = detail.slug === slug ? detail : { status: 'loading' }
  if (loadingIndex || current.status === 'loading') {
    return <div role="status" className="container-tr py-24 text-center text-sm text-ink-soft dark:text-paper/60">Cargando producto…</div>
  }
  if (current.status !== 'ready') {
    const missing = current.status === 'not-found'
    return (
      <div className="container-tr py-16 text-center" role={missing ? 'status' : 'alert'}>
        <h1 className="font-display text-2xl font-bold text-ink dark:text-paper">
          {missing ? 'Producto no encontrado' : 'No pudimos cargar el producto'}
        </h1>
        <p className="mt-3 text-sm text-ink-soft dark:text-paper/70">
          {missing ? 'El producto no existe o ya no está disponible.' : 'La información no está disponible en este momento. Intenta de nuevo.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {!missing && <button type="button" className="btn-primary" onClick={() => setRetry((n) => n + 1)}>Reintentar</button>}
          <Link to="/catalogo" className="btn-secondary">Ver catálogo</Link>
        </div>
      </div>
    )
  }

  const product = current.product
  const gallery = product.images?.length ? product.images : product.image ? [product.image] : []
  const related = index.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)

  const category = getCategoryBySlug(product.category)
  const discount = calculateDiscountPercent(product.price, product.compareAtPrice)
  const outOfStock = product.stock <= 0

  return (
    <div className="store-product-detail container-tr py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbStructuredData(product, category, STORE_ORIGIN)) }} />
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-ink-soft/70 dark:text-paper/50" aria-label="Ruta de navegación">
        <Link to="/" className="hover:text-route">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        {category && <Link to={`/categoria/${encodeURIComponent(category.slug)}`} className="hover:text-route">{category.name}</Link>}
        <ChevronRight className="h-3 w-3" />
        <span aria-current="page" className="text-ink dark:text-paper">{product.name}</span>
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
                posterUrl={product.model3DPoster || gallery[0]}
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
                {gallery.length ? <button type="button" className="product-zoom-trigger" onClick={() => setZoomOpen(true)} aria-label={`Ampliar imagen de ${product.name}`}><img src={optimizeImage(gallery[Math.min(activeImage, gallery.length - 1)],1200)} width="1200" height="1200" loading="eager" decoding="async" alt={product.name} className="h-auto max-h-[85vh] w-full" /><span>Ampliar imagen</span></button> : <p className="p-8 text-center">Imagen no disponible</p>}
              </div>
              {gallery.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Ver imagen ${i + 1} de ${product.name}`}
                      className={`h-16 w-16 overflow-hidden rounded-lg border-2 bg-route-soft transition-colors dark:bg-route-softDark ${activeImage === i ? 'border-route' : 'border-transparent'}`}
                    >
                      <img src={optimizeImage(img,128)} width="64" height="64" loading="lazy" alt="" className="h-full w-full object-contain" />
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
          {product.ratingCount > 0 && <a href="#resenas"><Rating count={product.ratingCount} sum={product.ratingSum}/></a>}

          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-ink dark:text-paper">{formatCurrency(product.price)}</span>
            {Number.isFinite(product.compareAtPrice) && product.compareAtPrice > product.price && (
              <>
                <span className="font-mono text-sm text-ink-soft/60 line-through dark:text-paper/40">{formatCurrency(product.compareAtPrice)}</span>
                <span className="rounded-full bg-signal-red/10 px-2 py-0.5 text-xs font-semibold text-signal-red">-{discount}%</span>
              </>
            )}
          </div>

          <StockBadge stock={product.stock} className="w-fit" />
          {(settings.storeBusiness?.shippingText?.trim() || settings.storeBusiness?.warrantyText?.trim()) && <dl className="product-commercial">
            {settings.storeBusiness.shippingText?.trim() && <div><dt>Envío</dt><dd>{settings.storeBusiness.shippingText}</dd></div>}
            {settings.storeBusiness.warrantyText?.trim() && <div><dt>Garantía</dt><dd>{settings.storeBusiness.warrantyText}</dd></div>}
          </dl>}
          <ProductShare product={product} />

          {benefits.length > 0 && <ul className="shop-benefits">{benefits.map(label=><li key={label}>{label}</li>)}</ul>}

          {!outOfStock && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft dark:text-paper/60">Cantidad</span>
              <QuantitySelector quantity={quantity} max={product.stock} onChange={setQuantity} />
            </div>
          )}
          {quantity > product.stock && !outOfStock && <p role="status" className="text-sm text-ink dark:text-paper">El stock cambió. Ajusta la cantidad antes de agregarlo.</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={outOfStock || !canAdd(product) || quantity > product.stock} onClick={() => addItem(product, quantity)} className="shop-purchase btn-primary flex-1">
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? 'Sin stock' : 'Agregar al carrito'}
            </button>
            <Link
              to="/checkout"
              onClick={event => { if (outOfStock || !canAdd(product) || quantity > product.stock || !addItem(product, quantity, { silent: true })) event.preventDefault() }}
              className={`btn-secondary flex-1 ${outOfStock || !canAdd(product) || quantity > product.stock ? 'opacity-40' : ''}`}
              aria-disabled={outOfStock || !canAdd(product) || quantity > product.stock}
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
              <table className="product-specifications">
                <caption>Ficha técnica</caption><tbody>
                {product.specifications.map((spec) => (
                  <tr key={spec.label}><th scope="row">{spec.label}</th><td>{spec.value}</td></tr>
                ))}
                </tbody></table>
            </div>
          )}
        </div>
      </div>

      <ProductReviews key={product.id} product={product}/>
      {zoomOpen && gallery.length > 0 && <Suspense fallback={<p role="status">Cargando ampliación…</p>}><ImageZoom images={gallery} active={Math.min(activeImage, gallery.length - 1)} name={product.name} onSelect={setActiveImage} onClose={() => setZoomOpen(false)} /></Suspense>}
      <div className="product-mobile-buy"><strong>{formatCurrency(product.price)}</strong><button type="button" disabled={outOfStock || !canAdd(product) || quantity > product.stock} onClick={() => addItem(product, quantity)}>{outOfStock ? 'Agotado' : 'Agregar al carrito'}</button></div>

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
