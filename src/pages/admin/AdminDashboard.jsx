import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Package, Users, Wallet } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { formatCurrency } from '../../utils/formatCurrency.js'
import { SectionHeader } from '../../components/admin/adminUi.jsx'

const STATUS_LABEL = { PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PAID: 'Pagado', SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' }

function Stat({ icon: Icon, label, value, to, tone = 'default', hint }) {
  const toneCls = tone === 'warn' ? 'border-signal-amber/40 bg-signal-amber/5' : 'border-paper-line dark:border-night-line'
  const body = (
    <div className={`h-full rounded-xl2 border p-4 transition-colors hover:border-route ${toneCls}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-ink-soft dark:text-paper/60"><Icon className="h-4 w-4" aria-hidden="true" />{label}</div>
      <p className="mt-2 font-display text-2xl font-bold text-ink dark:text-paper">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft dark:text-paper/50">{hint}</p>}
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

export default function AdminDashboard() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setData(await api.admin.getDashboard(token)) } catch (e) { setError(e.message) }
  }, [token])
  useEffect(() => { load() }, [load])

  return (
    <section aria-labelledby="dash-title">
      <SectionHeader id="dash-title" title="Resumen" description="Lo que necesita tu atención hoy." />
      {error && <p role="alert" className="mb-3 text-sm text-signal-red">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {!data && !error && <p role="status" className="text-sm text-ink-soft dark:text-paper/60">Cargando resumen…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={ClipboardList} label="Pedidos pendientes" value={data.orders.pending} to="/admin/pedidos" tone={data.orders.pending > 0 ? 'warn' : 'default'} hint={`${data.orders.last7Days} en los últimos 7 días`} />
            <Stat icon={Wallet} label="Ventas cobradas (30 días)" value={formatCurrency(data.revenue30Days)} hint="Pagados, enviados y entregados" />
            <Stat icon={Package} label="Stock bajo / agotado" value={`${data.stock.low} / ${data.stock.out}`} to="/admin/productos" tone={data.stock.low + data.stock.out > 0 ? 'warn' : 'default'} hint={`Bajo = ${data.stock.threshold} o menos`} />
            <Stat icon={Users} label="Clientes" value={data.customers} to="/admin/clientes" />
          </div>

          {(data.catalog.withoutBrand > 0 || data.catalog.inLegacyCategories > 0) && (
            <div role="note" className="mt-4 flex gap-3 rounded-xl2 border border-signal-amber/40 bg-signal-amber/5 p-4 text-sm text-ink dark:text-paper">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-signal-amber" aria-hidden="true" />
              <p>
                {data.catalog.inLegacyCategories} producto(s) siguen en categorías heredadas y {data.catalog.withoutBrand} no tienen marca.{' '}
                <Link to="/admin/asignar" className="font-medium text-route underline">Asignarlos en bloque</Link>
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-display text-base font-bold text-ink dark:text-paper">Pedidos recientes</h3>
              {data.recentOrders.length === 0 ? <p className="text-sm text-ink-soft dark:text-paper/60">Aún no hay pedidos.</p> : (
                <ul className="divide-y divide-paper-line rounded-xl2 border border-paper-line dark:divide-night-line dark:border-night-line">
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0"><span className="block truncate font-medium text-ink dark:text-paper">{o.customer}</span><span className="text-xs text-ink-soft dark:text-paper/50">{new Date(o.createdAt).toLocaleString('es-PE')}</span></span>
                      <span className="shrink-0 text-right"><span className="block font-mono font-semibold text-ink dark:text-paper">{formatCurrency(o.total)}</span><span className="text-xs text-ink-soft dark:text-paper/60">{STATUS_LABEL[o.status] ?? o.status}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-display text-base font-bold text-ink dark:text-paper">Productos con poco stock</h3>
              {data.stock.lowList.length === 0 ? <p className="text-sm text-ink-soft dark:text-paper/60">Todo con buen stock.</p> : (
                <ul className="divide-y divide-paper-line rounded-xl2 border border-paper-line dark:divide-night-line dark:border-night-line">
                  {data.stock.lowList.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <Link to={`/producto/${p.slug}`} className="min-w-0 truncate text-ink hover:text-route dark:text-paper">{p.name}</Link>
                      <span className="shrink-0 rounded-full bg-signal-amber/15 px-2 py-0.5 text-xs font-semibold text-signal-amber">{p.stock} u.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}