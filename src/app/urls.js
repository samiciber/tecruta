export const PANEL_ORIGIN = import.meta.env?.VITE_PANEL_ORIGIN || (import.meta.env?.DEV ? 'http://127.0.0.1:5180' : 'https://admin.tecruta.com')
export const STORE_ORIGIN = import.meta.env?.VITE_STORE_ORIGIN || (import.meta.env?.DEV ? 'http://127.0.0.1:5173' : 'https://www.tecruta.com')
export const STAFF_ROLES = ['ADMIN', 'WAREHOUSE', 'CASHIER']
export function staffHome(role) { return role === 'CASHIER' ? '/pos' : role === 'WAREHOUSE' ? '/inventario' : '/' }
export function legacyPanelPath(pathname) { return (pathname === '/admin' ? '/' : pathname.startsWith('/admin/') ? pathname.slice(6) : pathname).replace(/^\/+/, '/') }
export function safePanelReturn(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://panel.invalid')
    const path = legacyPanelPath(url.pathname)
    if (url.origin !== 'https://panel.invalid' || ['/iniciar-sesion', '/recuperar-contrasena'].includes(path)) return fallback
    // Only application routes, never a free-form external or unknown destination.
    if (!/^\/(?:$|pos(?:\/|$)|inventario(?:\/|$)|productos(?:\/|$)|pedidos(?:\/|$)|usuarios(?:\/|$)|clientes(?:\/|$)|home-layout(?:\/|$)|categorias(?:\/|$)|asignar(?:\/|$)|pagos(?:\/|$)|menu(?:\/|$)|menus(?:\/|$)|marcas(?:\/|$)|busquedas(?:\/|$)|tiendas(?:\/|$)|banners(?:\/|$)|circulos(?:\/|$)|footer(?:\/|$)|suscriptores(?:\/|$)|ajustes(?:\/|$))/.test(path)) return fallback
    return path + url.search + url.hash
  } catch { return fallback }
}
export function apiBase(value = '') { return value.trim().replace(/\/+$/, '').replace(/\/api$/, '') }
