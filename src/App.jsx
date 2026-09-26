import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import CartDrawer from './components/cart/CartDrawer.jsx'
import MobileCartBar from './components/cart/MobileCartBar.jsx'

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
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts.jsx'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders.jsx'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories.jsx'))
const AdminPaymentMethods = lazy(() => import('./pages/admin/AdminPaymentMethods.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-route border-t-transparent" />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* El header es `fixed` en escritorio (para poder ocultarse/mostrarse
          al scrollear sin empujar el contenido) y por lo tanto ya no
          reserva su propio espacio en el flujo normal — hay que
          compensarlo con padding-top acá. En la Home NO se compensa a
          propósito: el Hero debe ir a pantalla completa por debajo del
          header transparente. */}
      <main className={`flex-1 ${isHome ? '' : 'lg:pt-16'}`}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/producto/:slug" element={<ProductDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/ayuda" element={<Help />} />
            <Route path="/legal/:type" element={<Legal />} />
            <Route path="/iniciar-sesion" element={<Login />} />
            <Route path="/crear-cuenta" element={<Register />} />
            <Route path="/verificar-correo" element={<VerifyEmail />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
            <Route path="/mis-pedidos" element={<OrderHistory />} />
            <Route path="/mis-direcciones" element={<Addresses />} />
            <Route path="/mi-cuenta" element={<Account />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminProducts />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="categorias" element={<AdminCategories />} />
              <Route path="pagos" element={<AdminPaymentMethods />} />
              <Route path="clientes" element={<AdminUsers />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <MobileCartBar />
    </div>
  )
}