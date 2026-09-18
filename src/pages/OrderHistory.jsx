import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { api } from '../services/api.js'
import { formatCurrency } from '../utils/formatCurrency.js'

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PAID: 'Pagado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

const STATUS_STYLES = {
  PENDING: 'bg-signal-amber/15 text-signal-amber',
  CONFIRMED: 'bg-route-soft text-route dark:bg-route-softDark',
  PAID: 'bg-signal-green/15 text-signal-green',
  SHIPPED: 'bg-route-soft text-route dark:bg-route-softDark',
  DELIVERED: 'bg-signal-green/15 text-signal-green',
  CANCELLED: 'bg-signal-red/15 text-signal-red',
}

export default function OrderHistory() {
  const { token, isAuthenticated } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.orders
      .mine(token)
      .then(setOrders)
      .catch((err) => setError(err.message))
  }, [token])

  if (!isAuthenticated) {
    return (
      <div className="container-tr py-16">
        <EmptyState
          icon={Package}
          title="Inicia sesión para ver tus pedidos"
          description="Tu historial de compras está disponible solo para cuentas registradas."
          action={
            <Link to="/iniciar-sesion" className="btn-primary mt-2">
              Iniciar sesión
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-tr py-10">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Mis pedidos</h1>

      {error && <p className="mb-6 text-sm text-signal-red">{error}</p>}

      {!orders && !error && <p className="text-sm text-ink-soft dark:text-paper/60">Cargando tus pedidos…</p>}

      {orders && orders.length === 0 && (
        <EmptyState
          icon={Package}
          title="Todavía no tienes pedidos"
          description="Cuando confirmes una compra por WhatsApp, aparecerá aquí."
          action={
            <Link to="/catalogo" className="btn-primary mt-2">
              Ver catálogo
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-4">
        {orders?.map((order) => (
          <div key={order.id} className="rounded-xl2 border border-paper-line p-5 dark:border-night-line">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink dark:text-paper">
                  Pedido del{' '}
                  {new Date(order.createdAt).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-ink-soft dark:text-paper/50">
                  {order.deliveryType === 'PICKUP' ? 'Punto de recojo' : 'Envío a domicilio'} · {order.distrito}, {order.provincia}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[order.status] || 'bg-paper-line text-ink-soft'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>

            <ul className="mb-3 flex flex-col gap-1.5 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-ink-soft dark:text-paper/60">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-mono text-ink dark:text-paper">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-paper-line pt-3 text-sm dark:border-night-line">
              <span className="text-ink-soft dark:text-paper/60">{order.paymentMethodLabel || 'Método de pago no especificado'}</span>
              <span className="font-mono text-base font-semibold text-ink dark:text-paper">{formatCurrency(order.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}