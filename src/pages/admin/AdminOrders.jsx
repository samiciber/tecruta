import React, { useContext, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Upload, ExternalLink } from 'lucide-react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { formatCurrency } from '../../utils/formatCurrency.js'

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

// Comprobante de pago del pedido: lo muestra si ya existe (imagen o PDF,
// según la extensión de la URL) y siempre permite subir uno nuevo o
// reemplazar el actual — reutiliza el MISMO endpoint público que usa el
// checkout (POST /api/orders/:orderId/receipt), sin ruta separada para
// admin.
function ReceiptManager({ order, onUpdated }) {
  const toast = useContext(ToastContext)
  const [uploading, setUploading] = useState(false)

  const isPdf = order.receiptUrl?.toLowerCase().split('?')[0].endsWith('.pdf')

  const handleSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const isImage = file.type?.startsWith('image/')
    const isFilePdf = file.type === 'application/pdf'
    if (!isImage && !isFilePdf) {
      toast?.showToast('El comprobante debe ser una imagen o un PDF.', 'error')
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast?.showToast('El comprobante pesa demasiado (máximo 8MB).', 'error')
      return
    }

    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      const { order: updated } = await api.orders.uploadReceipt(order.id, dataUrl)
      onUpdated(updated)
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

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-paper-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-route hover:text-route dark:border-night-line dark:text-paper/60">
        <Upload className="h-3.5 w-3.5" />
        {uploading ? 'Subiendo…' : order.receiptUrl ? 'Reemplazar comprobante' : 'Subir comprobante'}
        <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading} onChange={handleSelect} />
      </label>
    </div>
  )
}

const STATUSES = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']
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
          <p className="text-sm font-medium text-ink dark:text-paper">
            {order.customerNombre} {order.customerApellido}
          </p>
          <p className="text-xs text-ink-soft dark:text-paper/50">
            {new Date(order.createdAt).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {order.distrito}, {order.provincia}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-ink dark:text-paper">{formatCurrency(order.total)}</span>
          <select
            value={order.status}
            onChange={handleStatusChange}
            disabled={updating}
            className={`rounded-full border-0 px-3 py-1.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
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
            <ReceiptManager order={order} onUpdated={onUpdated} />
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
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (status) => {
    setLoading(true)
    api.admin
      .getOrders(status ? { status } : {}, token)
      .then(setOrders)
      .catch((err) => toast?.showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(statusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleUpdated = (updated) => {
    setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-tr max-w-xs">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-soft dark:text-paper/60">{orders.length} pedidos</span>
      </div>

      {loading && <p className="text-sm text-ink-soft dark:text-paper/60">Cargando pedidos…</p>}
      {!loading && orders.length === 0 && <p className="text-sm text-ink-soft dark:text-paper/60">No hay pedidos con ese filtro.</p>}

      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} token={token} onUpdated={handleUpdated} />
        ))}
      </div>
    </div>
  )
}