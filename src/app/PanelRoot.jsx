import React, { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import PanelGate from './PanelGate.jsx'
import { legacyPanelPath } from './urls.js'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import PanelLogin from '../pages/panel/PanelLogin.jsx'
import ForgotPassword from '../pages/ForgotPassword.jsx'
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout.jsx'))
const Pos = lazy(() => import('../pages/pos/Pos.jsx'))
const pages = {
  productos: lazy(() => import('../pages/admin/AdminProducts.jsx')),
  pedidos: lazy(() => import('../pages/admin/AdminOrders.jsx')),
  pagos: lazy(() => import('../pages/admin/AdminPaymentMethods.jsx')),
  clientes: lazy(() => import('../pages/admin/AdminUsers.jsx')),
  usuarios: lazy(() => import('../pages/panel/StaffUsers.jsx')),
  marcas: lazy(() => import('../pages/admin/AdminBrands.jsx')),
  busquedas: lazy(() => import('../pages/admin/AdminPopularSearches.jsx')),
  tiendas: lazy(() => import('../pages/admin/AdminStores.jsx')),
  ajustes: lazy(() => import('../pages/admin/AdminSiteSettings.jsx')),
  categorias: lazy(() => import('../pages/admin/AdminCategoryTree.jsx')),
  asignar: lazy(() => import('../pages/admin/AdminAssignProducts.jsx')),
  circulos: lazy(() => import('../pages/admin/AdminHomeCircles.jsx')),
  'home-layout': lazy(() => import('../pages/admin/AdminHomeLayout.jsx')),
  footer: lazy(() => import('../pages/admin/AdminFooter.jsx')),
  suscriptores: lazy(() => import('../pages/admin/AdminNewsletter.jsx')),
  banners: lazy(() => import('../pages/admin/AdminBanners.jsx')),
  menu: lazy(() => import('../pages/admin/AdminMenu.jsx')),
  menus: lazy(() => import('../pages/admin/AdminNavMenus.jsx')),
  inventario: lazy(() => import('../pages/admin/AdminInventory.jsx')),
}
const Dashboard = lazy(() => import('../pages/admin/AdminDashboard.jsx'))
function LegacyRoute() {
  const location = useLocation()
  return <Navigate to={legacyPanelPath(location.pathname) + location.search + location.hash} replace />
}
export default function PanelRoot() {
  const location = useLocation()
  const isPos = location.pathname === '/pos' || location.pathname.startsWith('/pos/')
  return <div className="min-h-screen bg-paper text-ink dark:bg-night dark:text-paper">{!isPos && <div className="fixed right-4 top-3 z-50"><ThemeToggle /></div>}<Suspense fallback={<p className="p-10" role="status">Cargando panel…</p>}><Routes>
    <Route path="/iniciar-sesion" element={<PanelLogin />} />
    <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
    <Route path="/admin/*" element={<LegacyRoute />} />
    <Route path="/pos/*" element={<PanelGate><Pos /></PanelGate>} />
    <Route path="/" element={<PanelGate><AdminLayout /></PanelGate>}>
      <Route index element={<Dashboard />} />
      {Object.entries(pages).map(([path, Page]) => <Route key={path} path={path} element={<Page />} />)}
      <Route path="*" element={<div className="p-6"><h1 className="text-2xl font-bold">Sección no encontrada</h1><a className="text-route underline" href="/">Volver al panel</a></div>} />
    </Route>
  </Routes></Suspense></div>
}
