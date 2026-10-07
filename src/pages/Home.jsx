import React from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/product/ProductCard.jsx'
import HeroSlider from '../components/home/HeroSlider.jsx'
import GuestStrip from '../components/home/GuestStrip.jsx'
import CategoryShowcase from '../components/home/CategoryShowcase.jsx'
import PromoBanner from '../components/home/PromoBanner.jsx'
import BestSellers from '../components/home/BestSellers.jsx'
import OffersSection from '../components/home/OffersSection.jsx'
import ExploreCategories from '../components/home/ExploreCategories.jsx'
import TrustSection from '../components/home/TrustSection.jsx'
import Testimonials from '../components/home/Testimonials.jsx'
import Reveal from '../components/animations/Reveal.jsx'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { useCategories } from '../hooks/useCategories.js'
import { countProducts } from '../utils/categoryTree.js'

// Producto real usado en el banner promocional — cámbialo por el id de
// cualquier otro producto real de src/data/products.js si quieres rotar
// la campaña.
const PROMO_PRODUCT_ID = 'cg02'

export default function Home() {
  const { index } = useProductIndex()
  const featured = index.filter((p) => p.featured)
  const bestSellers = index.filter((p) => p.bestSeller)
  const promoProduct = index.find((p) => p.id === PROMO_PRODUCT_ID)
  // Conteo de productos por categoría de primer nivel (incluye su rama).
  const { categories } = useCategories()
  const conteos = Object.fromEntries(categories.map((c) => [c.slug, countProducts(c, index)]))

  return (
    <div>
      <HeroSlider />
      <GuestStrip />

      <Reveal>
        <CategoryShowcase counts={conteos} />
      </Reveal>

      {/* Destacados */}
      {featured.length > 0 && (
        <section className="border-t border-paper-line bg-paper-surface py-16 dark:border-night-line dark:bg-night-surface sm:py-24">
          <div className="container-tr">
            <Reveal className="mb-8 flex items-end justify-between sm:mb-10">
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-route">Selección TecRuta</span>
                <h2 className="font-display text-3xl font-bold tracking-tight text-ink dark:text-paper sm:text-4xl">Destacados</h2>
              </div>
              <Link to="/catalogo" className="text-sm font-medium text-route hover:underline">
                Ver todo
              </Link>
            </Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 6) * 60} duration={500}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <Reveal>
        <PromoBanner
          eyebrow="Tecnología sin límites"
          title="Carga rápida a donde vayas"
          description="Encuentra accesorios diseñados para acompañar tu ritmo, dentro y fuera de casa."
          product={promoProduct}
        />
      </Reveal>

      <Reveal>
        <OffersSection products={index} />
      </Reveal>

      <Reveal>
        <BestSellers products={bestSellers} />
      </Reveal>

      <Reveal>
        <Testimonials />
      </Reveal>

      <Reveal>
        <ExploreCategories counts={conteos} />
      </Reveal>

      <Reveal>
        <TrustSection />
      </Reveal>
    </div>
  )
}