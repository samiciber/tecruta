import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, CircleDollarSign, CircleHelp, Package, Truck } from 'lucide-react'
import { BestSellersCard, CartPageItem, SavedItemsCard } from '../components/cart/CartParts.jsx'
import { useCart } from '../hooks/useCart.js'
import { useAuth } from '../hooks/useAuth.js'
import { useSiteSettings } from '../hooks/useSiteContent.js'
import { useProductIndex } from '../hooks/useProductIndex.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { CartReviewNotice } from '../components/ui/CatalogAvailability.jsx'

// Íconos fijos por posición; texto y destino son editables (Admin → Ajustes).
const FOOTER_ICONS = [CircleHelp, Package, Truck, ArrowLeftRight, CircleDollarSign]
const FOOTER_DEFAULT = [
  { href: '/ayuda', label: 'Centro de ayuda' },
  { href: '/mis-pedidos', label: 'Consulta el estado de tu pedido' },
  { href: '/ayuda#envios', label: 'Información de envío' },
  { href: '/ayuda#garantia', label: 'Información de garantía' },
  { href: '/ayuda#pagos', label: 'Métodos de pago' },
]

export default function Cart() {
  const { items, itemCount, subtotal, canCheckout } = useCart()
  const { isAuthenticated } = useAuth()
  const { index } = useProductIndex()
  const { settings } = useSiteSettings()
  const footer = settings.cartFooterLinks ?? FOOTER_DEFAULT

  const inCart = useMemo(() => new Set(items.map((i) => i.id)), [items])
  const bestSellers = useMemo(() => {
    const best = index.filter((p) => p.bestSeller && !inCart.has(p.id))
    return (best.length > 0 ? best : index.filter((p) => p.featured && !inCart.has(p.id))).slice(0, 12)
  }, [index, inCart])

  const savings = items.reduce((s, i) => s + (i.compareAtPrice > i.price ? (i.compareAtPrice - i.price) * i.quantity : 0), 0)
  const empty = itemCount === 0

  return (
    <div className="bg-gray-100 dark:bg-night">
      <div className="container-tr grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-ink dark:text-paper">{empty ? 'Tu carrito está vacío' : `Tu carrito (${itemCount})`}</h1>
            {!isAuthenticated && (
              <p className="mt-1 text-sm text-ink dark:text-paper/80">
                ¿Tienes una cuenta? <Link to="/iniciar-sesion" className="text-header underline dark:text-sky-300">Inicia sesión para ver tu carrito</Link>
              </p>
            )}
          </div>

          {!empty && (
            <section aria-label="Artículos del carrito" className="rounded border border-gray-200 bg-white px-5 dark:border-night-line dark:bg-night-surface sm:px-6">
              <ul className="divide-y divide-gray-200 dark:divide-night-line">
                {items.map((item) => <CartPageItem key={item.id} item={item} />)}
              </ul>
            </section>
          )}

          <CartReviewNotice />
          <SavedItemsCard />
          <BestSellersCard products={bestSellers} />
        </div>

        <aside aria-label="Resumen del orden" className="h-fit min-w-0 rounded bg-white p-5 dark:bg-night-surface lg:sticky lg:top-40">
          <h2 className="text-center text-lg font-bold text-ink dark:text-paper">Resumen del orden</h2>
          <dl className="mt-5 space-y-2 text-sm text-ink dark:text-paper">
            {!empty && (
              <div className="flex justify-between"><dt>Subtotal ({itemCount} artículo{itemCount === 1 ? '' : 's'})</dt><dd>{formatCurrency(subtotal + savings)}</dd></div>
            )}
            {savings > 0 && <div className="flex justify-between font-medium text-signal-green"><dt>Ahorro</dt><dd>-{formatCurrency(savings)}</dd></div>}
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatCurrency(subtotal)}</dd></div>
          </dl>
          <Link to={empty ? '/catalogo' : '/checkout'} aria-disabled={!empty && !canCheckout} onClick={event => { if (!empty && !canCheckout) event.preventDefault() }} className={`mt-5 block rounded bg-header py-3 text-center text-sm font-bold text-white hover:bg-header-band focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header focus-visible:ring-offset-2 ${!empty && !canCheckout ? 'opacity-50' : ''}`}>
            {empty ? 'Sigue comprando' : 'Ir a pagar'}
          </Link>
          {!empty && <p className="mt-3 text-center text-xs text-ink-soft dark:text-paper/60">El pago se coordina por WhatsApp al finalizar.</p>}
        </aside>
      </div>

      <nav aria-label="Ayuda y políticas" className="container-tr py-10">
        <ul className="grid grid-cols-2 gap-6 text-center sm:grid-cols-3 lg:grid-cols-5">
          {footer.map(({ href, label }, i) => {
            const Icon = FOOTER_ICONS[i]
            const external = /^https?:\/\//.test(href)
            const cls = 'flex flex-col items-center gap-3 text-sm font-medium text-header hover:underline dark:text-sky-300'
            const inner = (
              <>
                <Icon className="h-12 w-12 text-ink-soft dark:text-paper/50" strokeWidth={1.2} aria-hidden="true" />
                {label}
              </>
            )
            return (
              <li key={i}>{external ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <Link to={href} className={cls}>{inner}</Link>}</li>
            )
          })}
        </ul>
      </nav>

    </div>
  )
}
