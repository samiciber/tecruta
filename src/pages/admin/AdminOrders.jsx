import React, { useContext, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Upload, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { useWorkspacePreference, useWorkspaceScroll } from '../../hooks/useWorkspaceMemory.js'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { formatCurrency } from '../../utils/formatCurrency.js'
import { canTransition, ORDER_STATUSES } from '../../utils/orderStatus.js'
import { Link, useSearchParams } from 'react-router-dom'

// Mismo límite que valida el backend (ver RECEIPT_MAX_BYTES en
// server/src/routes/orders.routes.js).
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Owner/admin endpoint returns only the new receipt URL.
function ReceiptManager({ order, token, onUpdated }) {
  const toast = useContext(ToastContext)
  const [uploading, setUploading] = useState(false)

  const isPdf = order.receiptUrl?.toLowerCase().split('?')[0].endsWith('.pdf')

  const handleSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    const isFilePdf = file.type === 'application/pdf'
    if (!isImage && !isFilePdf) {
      toast?.showToast('El comprobante debe ser JPEG, PNG, GIF, WebP o PDF.', 'error')
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast?.showToast('El comprobante pesa demasiado (máximo 8MB).', 'error')
      return
    }

    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      const { receiptUrl } = await api.orders.uploadReceipt(order.id, dataUrl, { token })
      onUpdated({ ...order, receiptUrl })
      toast?.showToast('Comprobante actualizado.', 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-paper-line pt-3 dark:border-night-line">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/40">Comprobante de pago</p>

      {order.receiptUrl ? (
        <a
          href={order.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-3 rounded-lg border border-paper-line p-2 transition-colors hover:border-ink/30 dark:border-night-line dark:hover:border-paper/30"
        >
          {isPdf ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-route-soft text-route dark:bg-route-softDark">
              <FileText className="h-5 w-5" />
            </div>
          ) : (
            <img src={order.receiptUrl} alt="Comprobante de pago" className="h-12 w-12 shrink-0 rounded-md object-cover" />
          )}
          <span className="flex items-center gap-1 text-sm font-medium text-route">
            Ver comprobante <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </a>
      ) : (
        <p className="text-sm text-ink-soft/70 dark:text-paper/40">El cliente no adjuntó comprobante.</p>
      )}

      <label className="focus-within:ring-2 focus-within:ring-route flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-paper-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-route hover:text-route dark:border-night-line dark:text-paper/60">
        <Upload className="h-3.5 w-3.5" />
        {uploading ? 'Subiendo…' : order.receiptUrl ? 'Reemplazar comprobante' : 'Subir comprobante'}
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="sr-only" disabled={uploading} onChange={handleSelect} />
      </label>
    </div>
  )
}

const STATUSES = ORDER_STATUSES
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

function OrderRow({ order, token, onUpdated }) {
  const toast = useContext(ToastContext)
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const nextStatus = order.status === 'PAID' && !order.posSale?._count?.refunds ? 'SHIPPED' : order.status === 'SHIPPED' ? 'DELIVERED' : null

  const handleStatusChange = async (e) => {
    const status = e.target.value
    if (status === order.status) return
    setUpdating(true)
    try {
      const updated = await api.admin.updateOrderStatus(order.id, { status }, token)
      onUpdated(updated)
      toast?.showToast(`Pedido actualizado a "${STATUS_LABELS[status]}".`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="rounded-xl2 border border-paper-line dark:border-night-line">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="mb-1 font-mono text-xs text-ink-soft dark:text-paper/60">Pedido {order.id}</p>
          <p className="text-sm font-medium text-ink dark:text-paper">
            {order.customerNombre} {order.customerApellido}
          </p>
          <p className="text-xs text-ink-soft dark:text-paper/50">
            {new Date(order.createdAt).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
            {' · '}
            {order.distrito}, {order.provincia}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-ink dark:text-paper">{formatCurrency(order.total)}</span>
          <select
            aria-label={`Estado del pedido ${order.id}`}
            value={order.status}
            onChange={handleStatusChange}
            disabled={updating}
            className={`rounded-full border-0 px-3 py-1.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} disabled={!canTransition(order.status, s) || (s === 'PAID' && !order.posSale?.confirmedAt) || (s === 'CANCELLED' && order.posSale?.confirmedAt && order.status !== 'CANCELLED') || (s === 'SHIPPED' && order.posSale?._count?.refunds > 0)}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-paper/10"
            aria-label={expanded ? 'Ocultar detalle' : 'Ver detalle'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 text-xs text-ink-soft dark:text-paper/60">
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-paper p-3 dark:bg-night"><strong>Siguiente paso:</strong>{nextStatus ? <button disabled={updating} className="btn-primary" onClick={() => { if (window.confirm(nextStatus === 'SHIPPED' ? '¿Confirmas que este pedido ya fue despachado?' : '¿Confirmas que este pedido ya fue entregado al cliente?')) handleStatusChange({ target: { value: nextStatus } }) }}>{nextStatus === 'SHIPPED' ? 'Registrar despacho' : 'Registrar entrega'}</button> : ['PENDING','CONFIRMED'].includes(order.status) && !order.posSale?.confirmedAt ? <Link to={`/pos?order=${encodeURIComponent(order.id)}`} className="btn-primary">Verificar y registrar cobro</Link> : <span>{order.posSale?._count?.refunds > 0 ? 'Revisar devoluciones antes de despachar.' : order.status === 'CANCELLED' ? 'Pedido cancelado; consultar historial.' : order.status === 'DELIVERED' ? 'Entrega finalizada.' : 'Revisar el detalle del pedido.'}</span>}</div>
        {order.posSale && <Link className="font-semibold text-route" to={`/pos?order=${encodeURIComponent(order.id)}`}>{`Ver cobro POS · ${order.posSale.status}`}</Link>}
        {order.posSale?._count?.refunds > 0 && <p className="mt-1">Esta venta tiene devoluciones en POS. Revisa la trazabilidad antes de despachar.</p>}
      </div>
      {expanded && (
        <div className="border-t border-paper-line px-4 py-3 dark:border-night-line">
          <ul className="mb-2 flex flex-col gap-1 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-ink-soft dark:text-paper/60">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="font-mono text-ink dark:text-paper">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft dark:text-paper/50">
            {order.customerCorreo} · {order.customerCelular} · {order.paymentMethodLabel || 'Sin método de pago'}
          </p>
          {order.direccion && (
            <p className="text-xs text-ink-soft dark:text-paper/50">
              {order.direccion} {order.numero} {order.referencia ? `· ${order.referencia}` : ''}
            </p>
          )}

          <div className="mt-3">
            <ReceiptManager order={order} token={token} onUpdated={onUpdated} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminOrders() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [orders, setOrders] = useState([])
  const [params, setParams] = useSearchParams()
  const statusFilter = STATUSES.includes(params.get('estado')) ? params.get('estado') : ''
  const query = params.get('buscar') || ''
  const [lastFilter, setLastFilter] = useWorkspacePreference('orders-filter', '', value => typeof value === 'string')
  useEffect(() => { if (!params.toString() && lastFilter) setParams(lastFilter, { replace: true }); else if (params.toString()) setLastFilter(params.toString()) }, [])
  useEffect(() => { setLastFilter(params.toString()) }, [params, setLastFilter])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0)
  const filter = (key, value) => setParams(current => { const next = new URLSearchParams(current); value ? next.set(key, value) : next.delete(key); return next }, { replace: true })
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    api.admin.getOrders(statusFilter ? { status: statusFilter } : {}, token).then(rows => { if (active) setOrders(rows) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [statusFilter, token, reload])
  useWorkspaceScroll(!loading)
  const visible = orders.filter(order => (!statusFilter || order.status === statusFilter) && [order.id, order.customerNombre, order.customerApellido, order.customerCorreo].join(' ').toLocaleLowerCase('es-PE').includes(query.trim().toLocaleLowerCase('es-PE')))

  const handleUpdated = (updated) => {
    setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Atención y entrega</p><h1 className="text-3xl font-bold">Pedidos web</h1><p className="mt-2 text-sm text-ink-soft dark:text-paper/60">Revisa el estado, abre el detalle y realiza la siguiente acción autorizada.</p></div><Link to="/pos/pedidos" className="btn-primary">Ir a cobrar pedidos</Link></div>
      <nav aria-label="Filtrar pedidos por estado" className="flex flex-wrap gap-2">{[['','Todos'], ['PENDING','Pendientes'], ['CONFIRMED','Confirmados'], ['PAID','Pagados'], ['SHIPPED','Enviados'], ['DELIVERED','Entregados'], ['CANCELLED','Cancelados']].map(([value,label])=><button key={value} aria-pressed={statusFilter===value} onClick={()=>filter('estado',value)} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${statusFilter===value?'border-route bg-route text-white':'border-paper-line bg-white dark:border-night-line dark:bg-night-surface'}`}>{label}</button>)}</nav>
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="relative w-full sm:max-w-md"><span className="sr-only">Buscar en los pedidos cargados</span><Search size={17} aria-hidden="true" className="absolute left-3 top-3.5 text-ink-soft"/><input type="search" value={query} onChange={e=>filter('buscar',e.target.value)} className="input-tr min-h-12 w-full pl-10" placeholder="Buscar en esta lista por cliente o referencia"/></label><button className="btn-secondary inline-flex items-center gap-2" onClick={()=>setReload(value=>value+1)}><RefreshCw size={16}/>Actualizar pedidos</button><span role="status" className="text-sm text-ink-soft dark:text-paper/60">{loading?'Cargando pedidos…':error?'No se pudo actualizar':visible.length+' pedidos en esta lista'}</span></div>
      <p className="text-xs text-ink-soft dark:text-paper/60">Los estados son los del pedido original. Una imagen de pago requiere verificación; registra el cobro en el POS antes de marcarlo como pagado.</p>
      {error && <p role="alert" className="rounded-xl border border-red-300 p-4 text-signal-red">{error} <button className="underline" onClick={()=>setReload(value=>value+1)}>Reintentar</button></p>}
      {!loading && !error && visible.length===0 && <p className="rounded-xl border border-dashed border-paper-line p-8 text-center dark:border-night-line">No hay pedidos con estos filtros.</p>}

      <div className="flex flex-col gap-3">
        {!loading && !error && visible.map((order) => (
          <OrderRow key={order.id} order={order} token={token} onUpdated={handleUpdated} />
        ))}
      </div>
    </div>
  )
}
