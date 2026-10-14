import React, { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { api } from '../services/api.js'
import { formatCurrency } from '../utils/formatCurrency.js'

const STATUS_LABELS = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PAID: 'Pagado',
  SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
}
const STATUS_STYLES = {
  PENDING: 'bg-signal-amber/15', CONFIRMED: 'bg-route-soft dark:bg-route-softDark',
  PAID: 'bg-signal-green/15', SHIPPED: 'bg-route-soft dark:bg-route-softDark',
  DELIVERED: 'bg-signal-green/15', CANCELLED: 'bg-signal-red/15',
}
const dateOptions = { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Lima' }
function dateLabel(value, withTime = false) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-PE', {
    ...dateOptions, ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
  })
}
const statusLabel = value => STATUS_LABELS[value] || 'Estado no disponible'

function OrderReceipt({ order, token }) {
  const [receipt, setReceipt] = useState(null)
  const pending = useRef(null)
  const current = receipt?.token === token ? receipt : null
  useEffect(() => () => { pending.current?.abort() }, [token])
  useEffect(() => () => {
    if (receipt?.url) URL.revokeObjectURL(receipt.url)
  }, [receipt?.url])

  const load = async () => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setReceipt({ token, loading: true })
    try {
      const blob = await api.orders.receipt(order.id, token, { signal: controller.signal })
      if (!controller.signal.aborted) setReceipt({ token, url: URL.createObjectURL(blob), type: blob.type })
    } catch (err) {
      if (!controller.signal.aborted) setReceipt({ token, error: err.message })
    }
  }

  return (
    <section className="min-w-0 border-t border-paper-line pt-4 dark:border-night-line" aria-label="Comprobante de pago">
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-paper">Comprobante de pago</h3>
      {!order.hasReceipt ? <p className="text-sm text-ink-soft dark:text-paper/70">No hay un comprobante adjunto.</p> : (
        <>
          {current?.error && <p role="alert" className="mb-2 break-words text-sm text-ink dark:text-paper">{current.error}</p>}
          {!current?.url && <button type="button" onClick={load} disabled={current?.loading} className="btn-secondary">
            {current?.loading ? 'Cargando comprobante…' : current?.error ? 'Reintentar comprobante' : 'Ver comprobante'}
          </button>}
          {current?.loading && <span role="status" className="sr-only">Cargando comprobante…</span>}
          {current?.url && <div className="space-y-3">
            {current.type !== 'application/pdf' && <img src={current.url} alt="Comprobante de pago adjunto al pedido" className="max-h-80 max-w-full rounded-lg object-contain" />}
            <div className="flex flex-wrap items-center gap-3">
              <a href={current.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                Abrir comprobante{current.type === 'application/pdf' ? ' (PDF)' : ''}
                <span className="sr-only"> en una pestaña nueva</span>
              </a>
              <button type="button" onClick={() => setReceipt(null)} className="btn-ghost">Ocultar comprobante</button>
            </div>
          </div>}
        </>
      )}
    </section>
  )
}

function OrderCard({ order, token }) {
  const titleId = useId()
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : []
  return (
    <article aria-labelledby={titleId} className="min-w-0 space-y-4 rounded-xl2 border border-paper-line p-5 dark:border-night-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-medium text-ink dark:text-paper">Pedido del {dateLabel(order.createdAt)}</h2>
          <p className="break-words text-xs text-ink-soft dark:text-paper/70">
            {order.deliveryType === 'PICKUP' ? 'Punto de recojo' : 'Envío a domicilio'} · {order.distrito}, {order.provincia}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium text-ink dark:text-paper ${STATUS_STYLES[order.status] || 'bg-paper-line dark:bg-night-line'}`}>
          {statusLabel(order.status)}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 text-ink-soft dark:text-paper/70">
            <span className="min-w-0 break-words">{item.quantity}x {item.name}</span>
            <span className="shrink-0 font-mono text-ink dark:text-paper">{formatCurrency(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-line pt-3 text-sm dark:border-night-line">
        <span className="min-w-0 break-words text-ink-soft dark:text-paper/70">{order.paymentMethodLabel || 'Método de pago no especificado'}</span>
        <span className="shrink-0 font-mono text-base font-semibold text-ink dark:text-paper">{formatCurrency(order.total)}</span>
      </div>
      <section className="border-t border-paper-line pt-4 dark:border-night-line" aria-label="Historial de estados">
        <h3 className="mb-3 text-sm font-semibold text-ink dark:text-paper">Historial de estados</h3>
        {history.length === 0 ? <p className="text-sm text-ink-soft dark:text-paper/70">No hay cambios de estado registrados para este pedido.</p> : (
          <ol className="ml-1 space-y-3 border-l-2 border-paper-line pl-4 dark:border-night-line">
            {history.map((event) => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-ink dark:text-paper">{statusLabel(event.status)}</span>
              <time dateTime={event.createdAt} className="text-xs text-ink-soft dark:text-paper/70">{dateLabel(event.createdAt, true)} (hora de Perú)</time>
            </li>)}
          </ol>
        )}
      </section>
      <OrderReceipt order={order} token={token} />
    </article>
  )
}

export default function OrderHistory() {
  const { token, user, isAuthenticated, authError, retrySession, authLoading } = useAuth()
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  const userId = user?.id
  const visible = result?.token === token && result?.userId === userId ? result : null

  useEffect(() => {
    if (!token || !isAuthenticated || authLoading || authError) return
    let active = true
    setResult({ token, userId, orders: null })
    api.orders.mine(token).then(orders => {
      if (active) setResult({ token, userId, orders })
    }).catch(err => {
      if (active) setResult({ token, userId, orders: null, error: err.message })
    })
    return () => { active = false }
  }, [token, userId, isAuthenticated, authLoading, authError, retry])

  if (authError) return <div className="container-tr py-16 text-ink dark:text-paper">
    <h1 className="mb-3 text-xl font-semibold">No pudimos comprobar tu sesión</h1>
    <button type="button" onClick={retrySession} className="btn-secondary">Reintentar sesión</button>
  </div>
  if (authLoading) return <div role="status" className="container-tr py-16 text-ink dark:text-paper">Comprobando sesión…</div>
  if (!isAuthenticated) return <div className="container-tr py-16">
    <EmptyState icon={Package} title="Inicia sesión para ver tus pedidos" description="Tu historial de compras está disponible solo para cuentas registradas."
      action={<Link to="/iniciar-sesion" className="btn-primary mt-2">Iniciar sesión</Link>} />
  </div>

  return (
    <div className="container-tr py-10">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Mis pedidos</h1>
      {visible?.error && <div role="alert" className="mb-6 text-sm text-ink dark:text-paper">
        <p className="mb-2 break-words">{visible.error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="btn-secondary">Reintentar pedidos</button>
      </div>}
      {!visible?.orders && !visible?.error && <p role="status" className="text-sm text-ink-soft dark:text-paper/70">Cargando tus pedidos…</p>}
      {visible?.orders?.length === 0 && <EmptyState icon={Package} title="Todavía no tienes pedidos"
        description="Cuando registres una compra con esta cuenta, aparecerá aquí."
        action={<Link to="/catalogo" className="btn-primary mt-2">Ver catálogo</Link>} />}
      <div className="flex flex-col gap-4">
        {visible?.orders?.map(order => <OrderCard key={order.id} order={order} token={token} />)}
      </div>
    </div>
  )
}
