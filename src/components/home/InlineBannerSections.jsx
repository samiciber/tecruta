import React from 'react'
import HeroSlide from './HeroSlide.jsx'

export default function InlineBannerSections({ groups }) {
  if (!groups?.length) return null
  return (
    <section className="container-tr py-6 sm:py-8" aria-label="Banners de campaña">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className={`grid gap-4 ${group.width === 'half' ? 'sm:grid-cols-2' : ''}`}>
            {group.banners.map((banner) => (
              <HeroSlide key={banner.id} slide={banner} size="banner" className="rounded-xl2" />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
