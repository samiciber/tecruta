import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import MobileStoreNav from './components/layout/MobileStoreNav.jsx'
import { PANEL_ORIGIN, legacyPanelPath } from './app/urls.js'
import { CatalogAvailability } from './components/ui/CatalogAvailability.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Catalog = lazy(() => import('./pages/Catalog.jsx'))
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'))
const Checkout = lazy(() => import('./pages/Checkout.jsx'))
const Help = lazy(() => import('./pages/Help.jsx'))
const Legal = lazy(() => import('./pages/Legal.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'))
const GoogleCallback = lazy(() => import('./pages/GoogleCallback.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const OrderHistory = lazy(() => import('./pages/OrderHistory.jsx'))
const Addresses = lazy(() => import('./pages/Addresses.jsx'))
const Account = lazy(() => import('./pages/Account.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
const Proximamente = lazy(() => import('./pages/Proximamente.jsx'))
const Cart = lazy(() => import('./pages/Cart.jsx'))
const Payments = lazy(() => import('./pages/account/Payments.jsx'))
const MyCard = lazy(() => import('./pages/account/MyCard.jsx'))
const Plans = lazy(() => import('./pages/account/Plans.jsx'))
const SavedItems = lazy(() => import('./pages/account/SavedItems.jsx'))
const BrandsPage = lazy(() => import('./pages/Brands.jsx'))
const BrandPage = lazy(() => import('./pages/BrandPage.jsx'))
const CategoryPage = lazy(() => import('./pages/CategoryPage.jsx'))
const CategoryDirectory = lazy(() => import('./pages/CategoryDirectory.jsx'))

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-route border-t-transparent" />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/') || location.pathname === '/pos' || location.pathname.startsWith('/pos/')) return <PanelRedirect />
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="sr-only z-[200] rounded bg-white px-4 py-2 text-sm font-bold text-ink shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>
      <Header />
      {/* El header es `fixed` en escritorio (para poder ocultarse/mostrarse
          al scrollear sin empujar el contenido) y por lo tanto ya no
          reserva su propio espacio en el flujo normal — hay que
          compensarlo con padding-top acá. En la Home NO se compensa a
          propósito: el Hero debe ir a pantalla completa por debajo del
          header transparente. */}
      {/* El header es sticky y ocupa su espacio: no se compensa con padding. */}
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <CatalogAvailability />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/categorias" element={<CategoryDirectory />} />
            <Route path="/producto/:slug" element={<ProductDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/ayuda" element={<Help />} />
            <Route path="/carrito" element={<Cart />} />
            <Route path="/proximamente" element={<Proximamente />} />
            <Route path="/marcas" element={<BrandsPage />} />
            <Route path="/marca/:slug" element={<BrandPage />} />
            <Route path="/categoria/:slug" element={<CategoryPage />} />
            <Route path="/pagos" element={<Payments />} />
            <Route path="/mi-tarjeta" element={<MyCard />} />
            <Route path="/planes" element={<Plans />} />
            <Route path="/elementos-guardados" element={<SavedItems />} />
            <Route path="/legal/:type" element={<Legal />} />
            <Route path="/iniciar-sesion" element={<Login />} />
            <Route path="/crear-cuenta" element={<Register />} />
            <Route path="/verificar-correo" element={<VerifyEmail />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
            <Route path="/mis-pedidos" element={<OrderHistory />} />
            <Route path="/mis-direcciones" element={<Addresses />} />
            <Route path="/mi-cuenta" element={<Account />} />
            <Route path="/admin/*" element={<PanelRedirect />} />
            <Route path="/pos/*" element={<PanelRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <MobileStoreNav />
    </div>
  )
}

function PanelRedirect() {
  const location = useLocation()
  const path = legacyPanelPath(location.pathname) + location.search + location.hash
  React.useEffect(() => { window.location.replace(PANEL_ORIGIN + path) }, [path])
  return <p className="p-8">Abriendo Panel TecRuta… <a className="text-route underline" href={PANEL_ORIGIN + path}>Continuar</a></p>
}
