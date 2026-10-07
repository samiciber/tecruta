import { api } from '../services/api.js'
import { FALLBACK_PILLS, FALLBACK_QUICK_LINKS } from '../data/navSeed.js'
import { useCachedResource } from './useCachedResource.js'

// Hooks de contenido editable desde el admin. Todos revalidan (TTL 60 s,
// al volver a la pestaña y tras guardar en el admin) y tienen un respaldo
// mínimo si la API falla: solo las 4 píldoras y los enlaces rápidos.

const DEFAULT_PROMO = { label: 'Fútbol americano de otoño', href: '/catalogo', visible: true }

const withIds = (items) =>
  items.map((it, i) => ({ id: `fb-${i}`, children: [], position: i, visible: true, href: null, ...it }))

// Respaldo: sin árbol completo, solo píldoras + enlaces rápidos. Los
// ítems PROMO usan el texto de la promo por defecto.
export const NAV_FALLBACK = {
  pills: FALLBACK_PILLS,
  menus: {
    acuerdos: [],
    soporte: [],
    descubre: [],
    mas: [],
    quick: withIds(FALLBACK_QUICK_LINKS).map((it) => (it.type === 'PROMO' ? { ...it, label: DEFAULT_PROMO.label, href: DEFAULT_PROMO.href } : it)),
  },
  seasonalPromo: DEFAULT_PROMO,
}

// { menus: { acuerdos, soporte, descubre, mas, quick }, seasonalPromo, pills, isFallback }
export function useNav() {
  const { data, isFallback, loading } = useCachedResource('nav', api.getNav, { fallback: NAV_FALLBACK })
  return { ...NAV_FALLBACK, ...data, pills: FALLBACK_PILLS, isFallback, loading }
}

// { featured: [...], all: [...] }
export function useBrands() {
  const { data, loading, error } = useCachedResource('brands', api.getBrands, { fallback: { featured: [], all: [] } })
  return { featured: data.featured, all: data.all, loading, error }
}

export function usePopularSearches() {
  const { data, loading } = useCachedResource('popular-searches', api.getPopularSearches, { fallback: [] })
  return { searches: data, loading }
}

// Tiendas activas (la predeterminada primero). Sin tiendas → la UI muestra
// "Tienda online".
export function useStores() {
  const { data, loading } = useCachedResource('stores', api.getStores, { fallback: [] })
  return { stores: data, defaultStore: data[0] ?? null, loading }
}

export function useSiteSettings() {
  const { data, loading } = useCachedResource('site-settings', api.getSiteSettings, {
    fallback: { seasonalPromo: DEFAULT_PROMO },
  })
  // homeBanners: [] y cartFooterLinks: null → la UI usa sus valores por defecto.
  return { settings: { seasonalPromo: DEFAULT_PROMO, homeBanners: [], cartFooterLinks: null, ...data }, loading }
}

// Árbol de categorías visibles (sin heredadas): [{ id, slug, name, children }]
export function useCategoryTree() {
  const { data, loading } = useCachedResource('category-tree', api.getCategoryTree, { fallback: [] })
  return { tree: data, loading }
}