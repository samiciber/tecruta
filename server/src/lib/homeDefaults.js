export const HOME_LAYOUT_KEY = 'homeLayout'

export const homeDefaults = {
  sections: [
    { id: 'hero', type: 'hero', active: true },
    { id: 'guest-strip', type: 'guestStrip', active: true },
    { id: 'circles', type: 'circles', active: true },
    {
      id: 'featured',
      type: 'products',
      active: true,
      title: 'Destacados',
      limit: 8,
      sources: [{ id: 'featured', label: 'Destacados', kind: 'featured', href: '/catalogo?featured=true' }],
    },
    {
      id: 'best-sellers',
      type: 'products',
      active: true,
      title: 'Más vendidos',
      limit: 8,
      sources: [{ id: 'best-sellers', label: 'Más vendidos', kind: 'bestSeller', href: '/catalogo' }],
    },
    {
      id: 'offers',
      type: 'products',
      active: true,
      title: 'Ofertas',
      limit: 8,
      sources: [{ id: 'offers', label: 'Ofertas', kind: 'discount', href: '/catalogo?ordenar=discount' }],
    },
  ],
}
