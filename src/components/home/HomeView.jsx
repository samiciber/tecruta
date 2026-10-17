import React, { useEffect, useRef, useState } from 'react'
import HeroSlider from './HeroSlider.jsx'
import CategoryShowcase from './CategoryShowcase.jsx'
import { ProductCarousel } from './ProductCarousel.jsx'
import InlineBannerSections from './InlineBannerSections.jsx'
import GuestStrip from './GuestStrip.jsx'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import HomeContentSection from './HomeContentSections.jsx'

function CampaignSection({ section, refresh }) {
  const [now, setNow] = useState(Date.now())
  const didRefresh = useRef(false)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  const expired = new Date(section.endsAt).getTime() <= now
  useEffect(() => {
    if (expired && !didRefresh.current) {
      didRefresh.current = true
      refresh()
    }
  }, [expired, refresh])
  if (expired) return null
  const remaining = Math.max(0, Math.floor((new Date(section.endsAt).getTime() - now) / 1000))
  const parts = [
    Math.floor(remaining / 86400),
    Math.floor((remaining % 86400) / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ]
  const timer = parts.map((part) => String(part).padStart(2, '0')).join(':')
  const tab = { id: section.id, label: section.source.label, href: section.source.href, products: section.products }
  return <ProductCarousel id={section.id} title={section.title} tabs={[tab]} countdown={timer} endsAt={section.endsAt} />
}

export function HomeView({ data, error, refresh }) {
  const { isAuthenticated, authLoading } = useAuth()
  const hasContentSection = data.sections.some((section) => section.type !== 'guestStrip')
    || (data.sections.some((section) => section.type === 'guestStrip') && !isAuthenticated && !authLoading)

  return (
    <div className="min-h-screen bg-paper dark:bg-night">
      {error && (
        <div role="status" className="container-tr pt-3">
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-ink dark:bg-night-surface dark:text-paper">No pudimos actualizar el Home; se conserva el último contenido válido. <button type="button" onClick={refresh} className="font-semibold underline">Reintentar</button></p>
        </div>
      )}
      {!hasContentSection && (
        <section className="container-tr py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink dark:text-paper">Aún no hay contenido para mostrar</h1>
          <p className="mt-2 text-sm text-ink-soft dark:text-paper/70">Puedes explorar el catálogo mientras se actualiza el inicio.</p>
          <Link to="/catalogo" className="btn-primary mt-5 inline-flex px-5 py-2.5">Explorar catálogo</Link>
        </section>
      )}
      {data.sections.map((section, index) => (
        <div
          key={section.id}
          className={`${section.appearance?.tone === 'soft' ? 'bg-route-soft dark:bg-route-softDark' : ''} ${section.appearance?.density === 'compact' ? '[&>section]:py-4' : ''}`}
          style={index > 1 ? { contentVisibility: 'auto', containIntrinsicSize: '560px' } : undefined}
        >
          {section.type === 'hero' && data.hero && (
            <HeroSlider slides={data.hero.slides} carouselConfig={data.hero.config} />
          )}
          {section.type === 'guestStrip' && <GuestStrip {...section} />}
          {section.type === 'circles' && data.circles && (
            <CategoryShowcase items={data.circles.items} title={data.circles.title} />
          )}
          {section.type === 'products' && <ProductCarousel id={section.id} title={section.title} tabs={section.tabs} panel={section.panel} />}
          {section.type === 'inlineBanners' && <InlineBannerSections groups={section.groups} />}
          {section.type === 'campaign' && <CampaignSection section={section} refresh={refresh} />}
          <HomeContentSection section={section} />
        </div>
      ))}
    </div>
  )
}
