import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Banknote, BarChart3, Barcode, CheckCircle2, CreditCard, Package, Plus, Printer, RefreshCw, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../services/api.js'
import { cents, amount, returnCents } from '../../utils/posMoney.js'
import { printPosTicket, methodLabel } from './posTicket.js'
import SessionUnavailable from '../../components/auth/SessionUnavailable.jsx'
import WorkspaceShell from '../../components/admin/WorkspaceShell.jsx'
import './pos.css'
import WebOrdersQueue from './WebOrdersQueue.jsx'
import SuspendedCash from './SuspendedCash.jsx'

const safe = value => { try { return cents(String(value || '0')) } catch { return 0n } }
const sol = value => `S/ ${Number(value || 0).toFixed(2)}`
const date = value => value ? new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—'
const statusLabel = { PENDING: 'Pago pendiente', CONFIRMED: 'Confirmada', CANCELLED: 'Pendiente cancelada', RETURNED: 'Devuelta', VOIDED: 'Anulada', OPEN: 'Abierta', CLOSED: 'Cerrada' }
const reportLabels = { id: 'Referencia', saleId: 'Venta', userId: 'Responsable', orderId: 'Pedido web', sessionId: 'Turno', fecha: 'Fecha (Lima)', status: 'Estado', customer: 'Cliente', subtotal: 'Subtotal', discount: 'Descuento', total: 'Total', refunded: 'Devuelto', net: 'Neto', approvedById: 'Aprobó descuento', historicalCost: 'Costo histórico', profit: 'Utilidad', method: 'Método', amount: 'Importe', received: 'Recibido', change: 'Vuelto', reference: 'Referencia de pago', productId: 'Producto', sku: 'SKU', name: 'Nombre', quantity: 'Unidades', returned: 'Devueltas', gross: 'Venta neta de descuento', openedAt: 'Apertura (Lima)', closedAt: 'Cierre (Lima)', opening: 'Inicial', expected: 'Esperado', counted: 'Contado', difference: 'Diferencia', note: 'Observación', reason: 'Motivo', kind: 'Operación', stock: 'Stock' }
const monetaryColumns = new Set(['subtotal', 'discount', 'total', 'refunded', 'net', 'amount', 'received', 'change', 'gross', 'opening', 'expected', 'counted', 'difference'])
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const newPayment = (method = 'cashOnDelivery') => ({ method, amount: '', received: '', reference: '', verified: false })
function Panel({ title, children, subtitle, className = '', id }) {
  return <section id={id} className={`pos-panel ${className}`}><div className="mb-4"><h2 className="text-lg font-bold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>{children}</section>
}
function PaymentEditor({ rows, setRows, config, total }) {
  const update = (index, field, value) => setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row))
  return <div className="space-y-3">
    {rows.map((row, index) => <div key={index} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex gap-2"><select aria-label={`Método ${index + 1}`} value={row.method} onChange={e => update(index, 'method', e.target.value)} className="pos-input flex-1">{config.methods.map(method => <option key={method.key} value={method.key}>{methodLabel[method.key] || method.label}</option>)}</select><button type="button" aria-label={`Retirar pago ${index + 1}`} onClick={() => setRows(current => current.filter((_, i) => i !== index))} className="pos-icon"><Trash2 size={16} /></button></div>
      <div className="grid grid-cols-2 gap-2"><label className="pos-label">Importe asignado<input aria-label={`Importe pago ${index + 1}`} inputMode="decimal" value={row.amount} onChange={e => update(index, 'amount', e.target.value)} className="pos-input" placeholder="0.00" /></label>
        {row.method === 'cashOnDelivery' ? <label className="pos-label">Efectivo recibido<input aria-label="Efectivo recibido" inputMode="decimal" value={row.received} onChange={e => update(index, 'received', e.target.value)} className="pos-input" placeholder={row.amount || '0.00'} /></label>
          : <label className="pos-label">Referencia verificada<input aria-label={`Referencia pago ${index + 1}`} value={row.reference} onChange={e => update(index, 'reference', e.target.value)} className="pos-input" placeholder="N.º de operación" maxLength={120} /></label>}
      </div>
      <button type="button" onClick={() => { const others = rows.reduce((sum, item, i) => i === index ? sum : sum + safe(item.amount), 0n); update(index, 'amount', amount(total > others ? total - others : 0n)) }} className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">Completar saldo restante</button>
      <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={row.verified} onChange={e => update(index, 'verified', e.target.checked)} className="mt-0.5" />{row.method === 'cashOnDelivery' ? 'Conté y recibí este efectivo.' : 'Verifiqué el abono en la cuenta o aplicación del negocio.'}</label>
      {row.method === 'cashOnDelivery' && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Vuelto: {sol(amount(safe(row.received || row.amount) > safe(row.amount) ? safe(row.received || row.amount) - safe(row.amount) : 0n))}</p>}
    </div>)}
    <button type="button" disabled={!config.allowMixed && rows.length > 0 || rows.length >= config.methods.length} className="pos-secondary w-full" onClick={() => { const next = config.methods.find(method => !rows.some(row => row.method === method.key)); if (next) setRows(current => [...current, newPayment(next.key)]) }}><Plus size={16} /> Añadir método de pago</button>
    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Una captura de pantalla no verifica el dinero. Confirma cada abono directamente antes de cobrar.</p>
  </div>
}

export default function Pos() {
  const auth = useAuth()
  if (auth.authError) return <SessionUnavailable onRetry={auth.retrySession} />
  if (auth.authLoading) return <p className="p-10">Comprobando sesión…</p>
  if (!auth.user) return <Navigate to="/iniciar-sesion" replace />
  if (!['ADMIN', 'CASHIER'].includes(auth.user.role)) return <Navigate to="/inventario" replace />
  return <PosWorkspace user={auth.user} token={auth.token} />
}
function PosWorkspace({ user, token }) {
  const isAdmin = user.role === 'ADMIN'
  const navigate = useNavigate(), location = useLocation()
  const section = location.pathname.split('/')[2] || 'venta'
  const scanner = useRef(null), scanQueue = useRef(Promise.resolve()), busyRef = useRef(false)
  const [config, setConfig] = useState({ methods: [], allowMixed: true })
  const [operators, setOperators] = useState([])
  const [sessions, setSessions] = useState([]), [sales, setSales] = useState([])
  const [cart, setCart] = useState([]), [query, setQuery] = useState(''), [found, setFound] = useState([]), [code, setCode] = useState('')
  const [payments, setPayments] = useState([newPayment()])
  const [customer, setCustomer] = useState({ name: '', document: '' }), [discount, setDiscount] = useState('0.00'), [discountReason, setDiscountReason] = useState('')
  const [webId, setWebId] = useState(() => new URLSearchParams(location.search).get('order') || ''), [webOrder, setWebOrder] = useState(null), [pendingSale, setPendingSale] = useState(null)
  const [lastSale, setLastSale] = useState(null), [selectedSale, setSelectedSale] = useState(null)
  const [message, setMessage] = useState(null), [busy, setBusy] = useState(false), [connected, setConnected] = useState(navigator.onLine)
  const [scanning, setScanning] = useState(0)
  const [loadingWeb, setLoadingWeb] = useState(false)
  const loadingWebRef = useRef(false)
  const [lastIdentified, setLastIdentified] = useState(null)
  const [customerOpen, setCustomerOpen] = useState(Boolean(new URLSearchParams(location.search).get('order')))
  const [attempt, setAttempt] = useState(() => { try { return JSON.parse(sessionStorage.getItem(`tecruta:pos-attempt:${user.id}`)) } catch { return null } })
  const [opening, setOpening] = useState('0.00'), [counted, setCounted] = useState(''), [closeReason, setCloseReason] = useState('')
  const [manual, setManual] = useState({ direction: 'IN', amount: '', reason: '' }), [entries, setEntries] = useState([])
  const [refund, setRefund] = useState({ kind: 'RETURN', method: 'cashOnDelivery', reason: '', reference: '', verified: false, lines: {} })
  const [filters, setFilters] = useState({ type: 'sales', from: today(), to: today(), userId: '', method: '', productId: '' }), [report, setReport] = useState(null), [fiscal, setFiscal] = useState(null)
  const cash = sessions.find(session => session.userId === user.id && session.status === 'OPEN')
  const frozen = busy || Boolean(attempt) || loadingWeb
  const subtotal = cart.reduce((sum, line) => sum + safe(line.price) * BigInt(Number.isInteger(line.quantity) ? line.quantity : 0), 0n)
  const total = pendingSale ? safe(pendingSale.total) : webOrder ? safe(webOrder.total) : subtotal >= safe(discount) ? subtotal - safe(discount) : 0n
  const paid = payments.reduce((sum, row) => sum + safe(row.amount), 0n)
  const ready = Boolean(cash) && connected && (cart.length > 0 || webOrder) && paid === total && payments.every(row => row.verified) && !frozen && !scanning
  let expectedRefund = 0n
  if (selectedSale) for (const line of selectedSale.items) {
    const quantity = Number(refund.lines[line.id]?.quantity || 0), returned = line.returns.reduce((sum, row) => sum + row.quantity, 0)
    if (Number.isSafeInteger(quantity) && quantity >= 0 && quantity + returned <= line.quantity) expectedRefund += returnCents(line.lineTotal, line.quantity, returned, quantity)
  }
  const notify = (text, kind = 'info') => setMessage({ text, kind })
  useEffect(() => { setMessage(null) }, [section])
  const refresh = useCallback(async () => {
    const [nextConfig, nextCash, nextSales, nextFiscal, nextOperators] = await Promise.all([api.pos.config(token), api.pos.cash(token), api.pos.sales(token), api.pos.fiscal(token), api.inventory.listOperators(token)])
    setConfig(nextConfig); setSessions(nextCash); setSales(nextSales); setFiscal(nextFiscal)
    setOperators(nextOperators)
  }, [token])
  useEffect(() => { refresh().catch(error => notify(error.message, 'error')) }, [refresh])
  useEffect(() => { const listener = () => setConnected(navigator.onLine); window.addEventListener('online', listener); window.addEventListener('offline', listener); return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener) } }, [])
  useEffect(() => {
    if (query.trim().length < 2) { setFound([]); return }
    let active = true; const controller = new AbortController()
    const timer = setTimeout(() => api.pos.search(query.trim(), token, { signal: controller.signal }).then(rows => { if (active) setFound(rows) }).catch(error => { if (active && error.name !== 'AbortError') notify(error.message, 'error') }), 300)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [query, token])
  const addProduct = product => {
    if (webOrder || pendingSale) return notify('Este registro conserva sus líneas originales. Inicia una venta nueva para cambiar productos.', 'error')
    setLastIdentified(product)
    setCart(current => {
      const line = current.find(row => row.id === product.id)
      if ((line?.quantity ?? 0) >= product.stock) { notify('No hay más unidades disponibles.', 'error'); return current }
      return line ? current.map(row => row.id === product.id ? { ...row, quantity: row.quantity + 1, stock: product.stock, price: String(product.price) } : row) : [...current, { ...product, price: String(product.price), quantity: 1 }]
    })
  }
  const scan = () => {
    if (!code.trim() || frozen) return
    const scanned = code.trim(); setCode(''); setScanning(count => count + 1)
    scanQueue.current = scanQueue.current.then(async () => {
      try { const product = await api.inventory.lookup(scanned, token); addProduct(product) }
      catch (error) { notify(error.message, 'error') }
      finally { setScanning(count => count - 1) }
    })
  }
  const reset = () => { setCart([]); setLastIdentified(null); setCustomerOpen(false); setWebId(''); setWebOrder(null); setPendingSale(null); setDiscount('0.00'); setDiscountReason(''); setCustomer({ name: '', document: '' }); setPayments([newPayment(config.methods.some(method => method.key === 'cashOnDelivery') ? 'cashOnDelivery' : config.methods[0]?.key)]); setLastSale(null) }
  const run = async (path, body, recovery = false) => {
    if (busyRef.current || (attempt && !recovery)) return
    busyRef.current = true; setBusy(true)
    const operation = { path, body, userId: user.id }
    try {
      sessionStorage.setItem(`tecruta:pos-attempt:${user.id}`, JSON.stringify(operation)); setAttempt(operation)
      const result = await api.pos.execute(path, body, token)
      sessionStorage.removeItem(`tecruta:pos-attempt:${user.id}`); setAttempt(null)
      if (result.items && result.payments) { reset(); setLastSale(result); setSelectedSale(result) }
      notify(result.status === 'PENDING' ? 'Venta pendiente guardada. No se cobró ni se reservó stock.' : 'Operación registrada correctamente.', 'success')
      try { await refresh() } catch { notify('La operación quedó registrada, pero no se pudo actualizar el panel. Conserva su referencia y recarga para consultar el historial.', 'error') }
      return result
    } catch (error) {
      if (error.status && error.status < 500) { sessionStorage.removeItem(`tecruta:pos-attempt:${user.id}`); setAttempt(null) }
      notify(error.status ? error.message : 'No se pudo conocer el resultado. Recupera el mismo intento antes de iniciar otro cobro.', 'error')
    } finally { busyRef.current = false; setBusy(false) }
  }
  const sell = mode => {
    if (!cash) return notify('Abre tu caja antes de operar.', 'error')
    const plan = (mode === 'PENDING' ? payments.filter(row => safe(row.amount) > 0n) : payments).map(row => ({ ...row, amount: row.amount || '0', received: row.method === 'cashOnDelivery' ? row.received || row.amount || '0' : row.amount || '0' }))
    if (mode === 'CONFIRM' && !window.confirm(`Confirmar cobro de ${sol(amount(total))}. Verifica efectivo y abonos reales antes de continuar.`)) return
    if (pendingSale) return run(`/sales/${pendingSale.id}/confirm`, { requestId: crypto.randomUUID(), sessionId: cash.id, payments: plan })
    return run('/sales', { requestId: crypto.randomUUID(), sessionId: cash.id, mode, ...(webOrder ? { orderId: webOrder.id, items: [], discount: '0.00' } : { items: cart.map(line => ({ productId: line.id, quantity: line.quantity, expectedPrice: line.price })), discount, discountReason: discountReason || undefined }), customerName: customer.name || null, customerDocument: customer.document || null, payments: plan })
  }
  const openPending = sale => {
    if (frozen) return
    reset(); setCustomerOpen(true); setPendingSale(sale); setCart(sale.items.map(line => ({ id: line.productId, name: line.name, sku: line.sku, price: String(line.unitPrice), quantity: line.quantity, stock: null })))
    setPayments(sale.payments.map(payment => ({ ...newPayment(payment.method), amount: String(payment.amount), received: String(payment.received), reference: payment.reference || '' })))
    setCustomer({ name: sale.customerName || '', document: sale.customerDocument || '' }); navigate('/pos')
  }
  const ticket = sale => { try { printPosTicket(sale) } catch (error) { notify(error.message, 'error') } }
  const loadWeb = async (selectedId = webId) => {
    if (frozen || loadingWebRef.current) return
    loadingWebRef.current = true; setLoadingWeb(true)
    try {
      const order = await api.pos.webOrder((typeof selectedId === 'string' ? selectedId : webId).trim(), token)
      if (order.posSale) { const sale = await api.pos.sale(order.posSale.id, token); if (sale.status === 'PENDING') openPending(sale); else { setSelectedSale(sale); navigate('/pos/ventas') }; return }
      if (!['PENDING', 'CONFIRMED'].includes(order.status)) return notify('Este pedido ya no está pendiente de pago.', 'error')
      reset(); navigate('/pos', { replace: true }); setWebId(order.id); setCustomerOpen(true); setWebOrder(order); setCustomer({ name: `${order.customerNombre} ${order.customerApellido}`, document: '' }); setPayments([{ ...newPayment(config.methods[0]?.key), amount: String(order.total) }])
    } catch (error) { notify(error.message, 'error') }
    finally { loadingWebRef.current = false; setLoadingWeb(false) }
  }
  const submitRefund = () => {
    if (!cash || !selectedSale) return notify('Abre tu caja para registrar el reembolso.', 'error')
    const items = selectedSale.items.flatMap(line => {
      const choice = refund.lines[line.id]
      return choice && Number(choice.quantity) > 0 ? [{ saleItemId: line.id, quantity: Number(choice.quantity), restock: choice.restock !== false }] : []
    })
    if (!items.length || !refund.reason.trim() || !refund.verified) return notify('Selecciona unidades, motivo y confirma el reembolso realizado.', 'error')
    if (!window.confirm('Registrar devolución y reembolso. El stock vendible y la caja se actualizarán una sola vez.')) return
    run(`/sales/${selectedSale.id}/refunds`, { requestId: crypto.randomUUID(), sessionId: cash.id, kind: refund.kind, method: refund.method, reference: refund.reference || null, reason: refund.reason, verified: true, expectedAmount: amount(expectedRefund), items })
  }
  const showReport = async () => { try { setReport(await api.pos.reports(filters, token)) } catch (error) { notify(error.message, 'error') } }
  const exportReport = async () => { try { const blob = await api.pos.export(filters, token); const href = URL.createObjectURL(blob), link = document.createElement('a'); link.href = href; link.download = `tecruta-${filters.type}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000) } catch (error) { notify(error.message, 'error') } }
  const leave = to => to.startsWith('/pos') || !(cart.length || webOrder || pendingSale || attempt) || window.confirm(attempt ? 'Hay un cobro por recuperar. Podrás recuperarlo al regresar; no inicies otro cobro. ¿Salir de esta pantalla?' : 'La venta actual no está guardada. Si sales se perderá su contenido. ¿Salir de esta pantalla?')
  const cashBadge = <span className={`rounded-full px-3 py-2 text-xs font-bold ${cash ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{cash ? '● Caja abierta' : '● Caja cerrada'}</span>
  return <WorkspaceShell beforeLeave={leave}><div className="pos-app">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><nav aria-label="Punto de venta" className="flex flex-wrap gap-2">{[['/pos', ShoppingBag, 'Venta actual'], ['/pos/ventas', CreditCard, 'Ventas y devoluciones'], ['/pos/reportes', BarChart3, 'Reportes']].map(([to, Icon, label])=><NavLink key={to} to={to} end className={({isActive})=>`pos-secondary ${isActive ? 'border-blue-500 text-blue-700 dark:text-blue-300' : ''}`}><Icon size={16} aria-hidden="true" />{label}</NavLink>)}</nav><Link to="/pos/caja" aria-label="Consultar mi turno de caja">{cashBadge}</Link></div>
      <main id="contenido-panel" className="min-w-0 space-y-4">
        {message && <div role="status" className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${message.kind === 'error' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200' : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200'}`}>{message.text}<button aria-label="Cerrar aviso" onClick={() => setMessage(null)}>×</button></div>}
        {!connected && <div role="alert" className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">Sin conexión. Los cobros están bloqueados hasta verificar precios, stock y pagos con el servidor.</div>}
        {attempt && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><div><strong>Hay una operación por recuperar.</strong><p>No repitas el cobro con una clave nueva. Este intento conserva su identificador al recargar.</p></div><button disabled={busy || !connected} className="pos-primary" onClick={() => run(attempt.path, attempt.body, true)}>Recuperar mismo intento</button></div>}
        {section === 'venta' && <>
          <div className="flex items-end justify-between gap-3"><div><p className="pos-eyebrow">PUNTO DE VENTA</p><h1 className="text-2xl font-bold">{pendingSale ? 'Cobrar venta pendiente' : webOrder ? 'Cobrar pedido web' : 'Nueva venta'}</h1></div><button disabled={frozen} onClick={() => { if ((cart.length || webOrder || pendingSale) && !window.confirm('Descartar la venta sin guardar e iniciar una nueva?')) return; reset(); scanner.current?.focus() }} className="pos-secondary"><Plus size={16} /> Nueva venta</button></div>
          {!cash && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Abre tu turno en <Link to="/pos/caja" className="font-bold underline">Caja</Link> antes de cobrar o guardar una venta.</div>}
          {lastSale && <Panel title={statusLabel[lastSale.status]} subtitle={`Registro ${lastSale.id}`}><div className="flex flex-wrap items-center gap-3"><span className="text-2xl font-bold">{sol(lastSale.total)}</span>{lastSale.confirmedAt ? <button className="pos-primary" onClick={() => ticket(lastSale)}><Printer size={16} /> Imprimir ticket interno</button> : <button className="pos-primary" onClick={() => openPending(lastSale)}>Abrir para cobrar</button>}<Link to="/pos/ventas" className="pos-secondary">Ver historial</Link></div></Panel>}

          <fieldset disabled={frozen} className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="min-w-0 space-y-5">
              <Panel title="Productos" subtitle="Escanea para agregar. Repite el código para sumar una unidad.">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500 dark:text-slate-400">{lastIdentified ? 'Último producto identificado: ' + lastIdentified.name : 'Listo para identificar productos'}</span><button type="button" className="text-sm font-semibold text-blue-600 dark:text-blue-300" disabled={Boolean(webOrder || pendingSale)} onClick={()=>scanner.current?.focus()}>Volver al lector</button></div>
                <form onSubmit={e => { e.preventDefault(); scan() }} className="mb-3 flex gap-2"><div className="relative min-w-0 flex-1"><Barcode size={21} className="absolute left-3 top-3 text-blue-600" /><input ref={scanner} aria-label="Escanear código" className="pos-input pl-11 font-mono" value={code} onChange={e => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" placeholder="SKU o código de barras + Enter" disabled={Boolean(webOrder || pendingSale)} /></div><button type="submit" className="pos-primary" disabled={Boolean(webOrder || pendingSale)}>Agregar</button></form>
                <div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Buscar productos" className="pos-input pl-10" placeholder="Buscar nombre, SKU o código (mín. 2 caracteres)" value={query} onChange={e => setQuery(e.target.value)} disabled={Boolean(webOrder || pendingSale)} /></div>
                {found.length > 0 && !webOrder && !pendingSale && <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">{found.map(product => <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-2 border-b border-slate-100 p-3 text-left text-sm last:border-0 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"><span><strong>{product.name}</strong><small className="block text-slate-500">{product.sku} · stock {product.stock}</small></span><span className="whitespace-nowrap font-semibold">{sol(product.price)}</span></button>)}</div>}
                <div className="mt-5 overflow-x-auto"><table className="pos-table"><thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Importe</th><th /></tr></thead><tbody>{(webOrder ? webOrder.items.map(line => ({ ...line, id: line.productId, price: String(line.unitPrice), stock: null })) : cart).map(line => <tr key={line.id} className={lastIdentified?.id === line.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}><td><strong>{line.name}</strong><small className="block font-mono text-xs text-slate-500 dark:text-slate-400">{line.sku}</small><small className="text-slate-500 dark:text-slate-400">{line.stock === null ? webOrder || pendingSale?.orderId ? 'Reservado en pedido web' : 'Se revalidará al cobrar' : `${line.stock} disponibles`}</small></td><td>{sol(line.price)}</td><td><input aria-label={`Cantidad ${line.name}`} type="number" min={1} max={1000000} className="pos-input w-20" disabled={Boolean(webOrder || pendingSale)} value={line.quantity} onChange={e => setCart(current => current.map(row => row.id === line.id ? { ...row, quantity: Math.max(1, Math.min(1000000, Number(e.target.value) || 1)) } : row))} /></td><td className="font-semibold">{sol(amount(safe(line.price) * BigInt(line.quantity)))}</td><td><button type="button" aria-label={`Retirar ${line.name}`} disabled={Boolean(webOrder || pendingSale)} className="pos-icon text-red-500" onClick={() => setCart(current => current.filter(row => row.id !== line.id))}><Trash2 size={16} /></button></td></tr>)}</tbody></table>{!cart.length && !webOrder && <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400"><Package size={38} strokeWidth={1.2} /><p className="font-semibold">Tu venta empieza con un producto</p><p className="text-xs">Usa el lector o la búsqueda manual.</p></div>}</div>
                {!!cart.length && !pendingSale && !webOrder && <button type="button" className="pos-secondary mt-3" onClick={async () => { try { const fresh = await Promise.all(cart.map(line => api.inventory.lookup(line.sku, token))); setCart(current => current.map(line => { const product = fresh.find(row => row.id === line.id); return { ...line, price: String(product.price), stock: product.stock } })); notify('Precios y existencias actualizados. Revisa el total y los pagos.') } catch (error) { notify(error.message, 'error') } }}><RefreshCw size={14} /> Actualizar precios y stock</button>}
              </Panel>
              <details className="pos-panel" open={customerOpen} onToggle={e=>setCustomerOpen(e.currentTarget.open)}><summary className="cursor-pointer font-semibold">Cliente o pedido por referencia</summary><p className="my-3 text-sm text-slate-500 dark:text-slate-400">Consumidor final no requiere datos. Completa estos campos solo si necesitas identificar al cliente o cargar una referencia.</p><div className="grid gap-3 sm:grid-cols-2"><label className="pos-label">Nombre (opcional)<input className="pos-input" value={customer.name} maxLength={120} disabled={Boolean(webOrder || pendingSale)} onChange={e => setCustomer(current => ({ ...current, name: e.target.value }))} placeholder="Consumidor final" /></label><label className="pos-label">Documento (opcional)<input className="pos-input" value={customer.document} maxLength={120} disabled={Boolean(webOrder || pendingSale)} onChange={e => setCustomer(current => ({ ...current, document: e.target.value }))} /></label></div><div className="mt-4 flex flex-wrap gap-2"><input aria-label="ID de pedido web" className="pos-input min-w-0 flex-1" value={webId} onChange={e => setWebId(e.target.value)} placeholder="ID de pedido web existente" /><button type="button" onClick={loadWeb} disabled={!webId.trim()} className="pos-secondary">Cargar pedido</button></div>{webOrder && <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">Pedido {webOrder.id}: stock ya reservado. Este cobro no vuelve a descontarlo.</p>}</details>
            </div>
            <Panel id="pos-checkout" title="Cobro" subtitle={pendingSale ? `Pendiente ${pendingSale.id}` : 'Revisión y confirmación de pagos'} className="pos-checkout h-fit">
              <div className="mb-4 space-y-2 border-b border-slate-200 pb-4 dark:border-slate-700"><p className="flex justify-between text-sm text-slate-500 dark:text-slate-400"><span>Subtotal</span><span>{sol(pendingSale?.subtotal || webOrder?.total || amount(subtotal))}</span></p>{isAdmin && !webOrder && !pendingSale && <div className="grid grid-cols-2 gap-2"><label className="pos-label">Descuento S/<input aria-label="Descuento autorizado" className="pos-input" value={discount} onChange={e => setDiscount(e.target.value)} inputMode="decimal" /></label><label className="pos-label">Motivo del descuento<input className="pos-input" value={discountReason} onChange={e => setDiscountReason(e.target.value)} maxLength={240} /></label></div>}<p className="flex items-center justify-between pt-2"><span className="font-semibold">Total a cobrar</span><strong data-testid="pos-total" className="text-3xl tracking-tight">{sol(amount(total))}</strong></p></div>
              <div className="pos-payment-scroll"><PaymentEditor rows={payments} setRows={setPayments} config={config} total={total} />
              <p className="my-4 flex justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-700"><span>Asignado a pagos</span><strong>{sol(amount(paid))}</strong></p>
              </div><div className="pos-checkout-actions"><button type="button" onClick={() => sell('CONFIRM')} disabled={!ready} className="pos-primary w-full py-3.5"><CheckCircle2 size={18} /> Confirmar venta y cobro</button>
              {!pendingSale && <button type="button" disabled={!cash || !connected || frozen || scanning > 0 || (!cart.length && !webOrder)} onClick={() => sell('PENDING')} className="pos-secondary mt-2 w-full">Guardar pago pendiente</button>}
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Ticket interno · sin emisión fiscal SUNAT.<br />El servidor verifica precios y stock al confirmar.</p>
              </div>
            </Panel>
          </fieldset>
        </>}
        {section === 'pedidos' && <><div><p className="pos-eyebrow">Atención de pedidos</p><h1 className="text-2xl font-bold">Pedidos web por cobrar</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Elige el pedido y verifica el pago antes de confirmar el cobro.</p></div><WebOrdersQueue token={token} disabled={frozen} onSelect={id=>{if(cart.length && !window.confirm('Cargar este pedido reemplazará la venta sin guardar. ¿Continuar?'))return;setWebId(id);loadWeb(id)}} /></>}
        {section === 'caja' && <>
          {isAdmin && <SuspendedCash sessions={sessions} token={token} onDone={refresh} />}
          <div><p className="pos-eyebrow">CONTROL DE EFECTIVO</p><h1 className="text-2xl font-bold">Mi turno de caja</h1></div>
          <fieldset disabled={frozen} className="grid gap-5 xl:grid-cols-2">
            {!cash ? <Panel title="Abrir caja" subtitle="Una caja abierta por cuenta. El saldo inicial es efectivo físico."><label className="pos-label">Saldo inicial S/<input aria-label="Saldo inicial" className="pos-input" inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} /></label><button className="pos-primary mt-4" onClick={() => run('/cash', { requestId: crypto.randomUUID(), openingAmount: opening })}>Abrir turno</button></Panel> : <Panel title="Caja abierta" subtitle={`${cash.id} · ${date(cash.openedAt)}`}><p className="text-sm text-slate-500 dark:text-slate-400">Efectivo esperado</p><strong className="my-2 block text-4xl" data-testid="cash-expected">{sol(cash.currentExpected)}</strong><p className="mb-5 text-xs text-slate-500 dark:text-slate-400">No incluye Yape, Plin ni transferencias. El vuelto ya está descontado.</p><label className="pos-label">Efectivo contado S/<input aria-label="Efectivo contado" className="pos-input" value={counted} inputMode="decimal" onChange={e => setCounted(e.target.value)} /></label><label className="pos-label mt-3">Observación del cierre<input aria-label="Observación del cierre" className="pos-input" value={closeReason} maxLength={240} onChange={e => setCloseReason(e.target.value)} /></label><p className="my-3 text-sm">Diferencia: {sol(amount(safe(counted) - safe(cash.currentExpected)))}</p><button disabled={!counted || !closeReason.trim()} className="pos-primary" onClick={() => { if (window.confirm('Cerrar este turno con el conteo indicado. No se podrá reabrir ni modificar.')) run(`/cash/${cash.id}/close`, { requestId: crypto.randomUUID(), countedAmount: counted, reason: closeReason }) }}>Cerrar turno definitivamente</button></Panel>}
            {isAdmin && cash && <Panel title="Ingreso o retiro manual" subtitle="Sólo administrador, en su caja abierta; siempre con motivo."><label className="pos-label">Movimiento<select className="pos-input" value={manual.direction} onChange={e => setManual(current => ({ ...current, direction: e.target.value }))}><option value="IN">Ingreso de efectivo</option><option value="OUT">Retiro de efectivo</option></select></label><label className="pos-label mt-3">Importe S/<input className="pos-input" value={manual.amount} inputMode="decimal" onChange={e => setManual(current => ({ ...current, amount: e.target.value }))} /></label><label className="pos-label mt-3">Motivo<input className="pos-input" maxLength={240} value={manual.reason} onChange={e => setManual(current => ({ ...current, reason: e.target.value }))} /></label><button disabled={!manual.reason || !manual.amount} className="pos-secondary mt-4" onClick={() => run(`/cash/${cash.id}/entries`, { requestId: crypto.randomUUID(), ...manual })}>Registrar movimiento de caja</button></Panel>}
          </fieldset>
          <Panel title="Historial de turnos" subtitle="Los cierres se conservan. Las correcciones posteriores usan un nuevo turno."><div className="overflow-x-auto"><table className="pos-table"><thead><tr><th>Apertura / responsable</th><th>Estado</th><th>Inicial</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th /></tr></thead><tbody>{sessions.map(session => <tr key={session.id}><td>{date(session.openedAt)}<small className="block text-slate-400">{operators.find(operator => operator.id === session.userId)?.nombre || session.userId}</small></td><td>{statusLabel[session.status]}</td><td>{sol(session.openingAmount)}</td><td>{sol(session.currentExpected)}</td><td>{session.countedAmount === null ? '—' : sol(session.countedAmount)}</td><td>{session.difference === null ? '—' : sol(session.difference)}</td><td><button className="pos-secondary" onClick={() => api.pos.entries(session.id, token).then(setEntries).catch(error => notify(error.message, 'error'))}>Ver movimientos</button></td></tr>)}</tbody></table></div>{entries.length > 0 && <div className="mt-4 max-h-72 overflow-auto">{entries.map(entry => <p key={entry.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">{date(entry.createdAt)} · {entry.kind} · <strong>{sol(entry.amount)}</strong> · {entry.reason}<small className="block text-slate-400">{entry.userId} · {entry.reference}</small></p>)}</div>}</Panel>
        </>}
        {section === 'ventas' && <>
          <div><p className="pos-eyebrow">TRAZABILIDAD</p><h1 className="text-2xl font-bold">Ventas y devoluciones</h1></div>
          <Panel title="Últimas ventas" subtitle="Hasta 100 registros recientes; usa reportes para periodos y CSV."><div className="overflow-x-auto"><table className="pos-table"><thead><tr><th>Fecha / venta</th><th>Cliente / origen</th><th>Estado</th><th>Total</th><th /></tr></thead><tbody>{sales.map(sale => <tr key={sale.id}><td>{date(sale.createdAt)}<small className="block font-mono text-[10px] text-slate-400">{sale.id}</small></td><td>{sale.customerName || 'Consumidor final'}<small className="block text-slate-400">{sale.orderId ? `Pedido web ${sale.orderId}` : 'Venta presencial'}</small></td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{statusLabel[sale.status]}</span></td><td className="font-semibold">{sol(sale.total)}</td><td><button className="pos-secondary" onClick={() => { setSelectedSale(sale); setRefund({ kind: 'RETURN', method: config.methods[0]?.key || 'cashOnDelivery', reason: '', reference: '', verified: false, lines: {} }) }}>Ver venta</button></td></tr>)}</tbody></table></div></Panel>
          {selectedSale && <Panel title={`Venta ${selectedSale.id}`} subtitle={`${statusLabel[selectedSale.status]} · ${selectedSale.user.nombre} ${selectedSale.user.apellido}`}><div className="mb-4 flex flex-wrap gap-2">{selectedSale.confirmedAt && <button className="pos-primary" onClick={() => ticket(selectedSale)}><Printer size={16} /> Imprimir ticket interno</button>}{selectedSale.status === 'PENDING' && <><button disabled={frozen} className="pos-primary" onClick={() => openPending(selectedSale)}>Cobrar pendiente</button><button disabled={frozen} className="pos-secondary" onClick={() => { const reason = window.prompt('Motivo de cancelación del pendiente'); if (reason?.trim()) run(`/sales/${selectedSale.id}/cancel`, { requestId: crypto.randomUUID(), reason }) }}>Cancelar pendiente</button></>}</div>
            <p className="mb-3 text-sm">{selectedSale.cancellationReason && <span className="mb-2 block">Motivo de cancelación: {selectedSale.cancellationReason}</span>}Total {sol(selectedSale.total)} · Descuento {sol(selectedSale.discount)}{selectedSale.approvedBy && ` · Aprobó ${selectedSale.approvedBy.nombre}`}</p>
            {selectedSale.payments.map(payment => <p key={payment.id} className="text-sm text-slate-500 dark:text-slate-400">{methodLabel[payment.method]} · {sol(payment.amount)} · {payment.status === 'CONFIRMED' ? 'Pago confirmado' : 'Plan pendiente'} · Vuelto {sol(payment.change)}{payment.reference && ` · Ref. ${payment.reference}`}</p>)}
            {isAdmin && selectedSale.status === 'CONFIRMED' && <fieldset disabled={frozen} className="mt-6 space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 className="font-bold">Devolución o anulación</h3><p className="text-xl font-bold" data-testid="refund-amount">Reembolso a realizar: {sol(amount(expectedRefund))}</p><div className="overflow-x-auto"><table className="pos-table"><thead><tr><th>Producto</th><th>Vendidas / devueltas</th><th>Devolver</th><th>Vendible</th></tr></thead><tbody>{selectedSale.items.map(line => { const returned = line.returns.reduce((sum, item) => sum + item.quantity, 0); const choice = refund.lines[line.id] || { quantity: 0, restock: true }; return <tr key={line.id}><td>{line.name}</td><td>{line.quantity} / {returned}</td><td><input aria-label={`Devolver ${line.name}`} type="number" min={0} max={line.quantity - returned} className="pos-input w-20" value={choice.quantity} onChange={e => setRefund(current => ({ ...current, lines: { ...current.lines, [line.id]: { ...choice, quantity: e.target.value } } }))} /></td><td><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={choice.restock} onChange={e => setRefund(current => ({ ...current, lines: { ...current.lines, [line.id]: { ...choice, restock: e.target.checked } } }))} />Vuelve a stock</label></td></tr> })}</tbody></table></div><p className="text-xs text-slate-500 dark:text-slate-400">Si está dañado, desmarca “Vuelve a stock”. Se conserva la entrada y la salida por daño sin aumentar stock vendible. El servidor calcula el reembolso con el descuento original.</p><div className="grid gap-3 sm:grid-cols-2"><label className="pos-label">Operación<select aria-label="Operación de devolución" className="pos-input" value={refund.kind} onChange={e => setRefund(current => ({ ...current, kind: e.target.value }))}><option value="RETURN">Devolución parcial o total</option><option value="VOID">Anulación: todas las unidades restantes</option></select></label><label className="pos-label">Método de reembolso<select aria-label="Método de reembolso" className="pos-input" value={refund.method} onChange={e => setRefund(current => ({ ...current, method: e.target.value }))}>{config.methods.map(method => <option key={method.key} value={method.key}>{methodLabel[method.key]}</option>)}</select></label><label className="pos-label">Motivo<input aria-label="Motivo de devolución" className="pos-input" value={refund.reason} maxLength={240} onChange={e => setRefund(current => ({ ...current, reason: e.target.value }))} /></label><label className="pos-label">Referencia del reembolso<input className="pos-input" value={refund.reference} maxLength={120} onChange={e => setRefund(current => ({ ...current, reference: e.target.value }))} /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={refund.verified} onChange={e => setRefund(current => ({ ...current, verified: e.target.checked }))} />Realicé y verifiqué el reembolso por el método seleccionado.</label><button className="pos-primary" onClick={submitRefund} disabled={!cash || !refund.verified}>Registrar devolución y reembolso</button></fieldset>}
            {selectedSale.refunds.map(row => <div key={row.id} className="mt-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800"><strong>{row.kind === 'VOID' ? 'Anulación' : 'Devolución'} · {sol(row.amount)} · {methodLabel[row.method]}</strong><p>{row.reason}</p><small>{date(row.createdAt)} · {row.userId} · {row.id}</small></div>)}
          </Panel>}
        </>}
        {section === 'reportes' && <>
          <div><p className="pos-eyebrow">CONTROL Y CONCILIACIÓN</p><h1 className="text-2xl font-bold">Reportes del negocio</h1></div>
          <Panel title="Filtros" subtitle="America/Lima. Los importes son registros del negocio, no confirmación automática del banco."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><label className="pos-label">Reporte<select className="pos-input" value={filters.type} onChange={e => setFilters(current => ({ ...current, type: e.target.value }))}>{[['sales','Ventas'],['payments','Pagos por método'],['products','Ventas por producto'],['cash','Cajas'],['refunds','Devoluciones'],['low-stock','Stock bajo']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="pos-label">Desde<input className="pos-input" type="date" value={filters.from} onChange={e => setFilters(current => ({ ...current, from: e.target.value }))} /></label><label className="pos-label">Hasta<input className="pos-input" type="date" value={filters.to} onChange={e => setFilters(current => ({ ...current, to: e.target.value }))} /></label><label className="pos-label">Método<select className="pos-input" value={filters.method} onChange={e => setFilters(current => ({ ...current, method: e.target.value }))}><option value="">Todos</option>{Object.entries(methodLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{isAdmin && <label className="pos-label">Usuario<select aria-label="Usuario del reporte" className="pos-input" value={filters.userId} onChange={e => setFilters(current => ({ ...current, userId: e.target.value }))}><option value="">Todos los usuarios</option>{operators.map(operator => <option key={operator.id} value={operator.id}>{operator.nombre} {operator.apellido}</option>)}</select></label>}<label className="pos-label">Buscar producto<input aria-label="Buscar producto del reporte" className="pos-input" value={query} onChange={e => { setQuery(e.target.value); setFilters(current => ({ ...current, productId: '' })) }} placeholder="Nombre o SKU (mín. 2 letras)" /></label><label className="pos-label">Producto<select aria-label="Producto del reporte" className="pos-input" value={filters.productId} onChange={e => setFilters(current => ({ ...current, productId: e.target.value }))}><option value="">Todos los productos</option>{found.map(product => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label></div><div className="mt-4 flex flex-wrap gap-2"><button className="pos-primary" onClick={showReport}>Consultar reporte</button><button className="pos-secondary" onClick={exportReport}>Exportar CSV</button><button className="pos-secondary" onClick={() => refresh().catch(error => notify(error.message, 'error'))}><RefreshCw size={15} /> Actualizar</button></div></Panel>
          {report && <Panel title="Resultados" subtitle={`${report.rows.length} registros · ${report.timeZone}`}><p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{report.costs}</p>{report.totals.net && <p className="mb-4 font-semibold">Ventas: {sol(report.totals.total)} · Devoluciones: {sol(report.totals.refunded)} · Neto: {sol(report.totals.net)}</p>}<div className="max-h-[520px] overflow-auto"><table className="pos-table"><thead><tr>{Object.keys(report.rows[0] || { resultado: '' }).map(key => <th key={key}>{reportLabels[key] || key}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}>{Object.entries(row).map(([key, value]) => <td key={key}>{value === null ? 'No disponible' : key === 'method' ? methodLabel[value] || value : key === 'status' ? statusLabel[value] || value : key === 'userId' || key === 'approvedById' ? operators.find(operator => operator.id === value)?.nombre || value : monetaryColumns.has(key) ? sol(value) : String(value)}</td>)}</tr>)}</tbody></table>{!report.rows.length && <p className="p-4 text-sm text-slate-500">Sin registros para este periodo.</p>}</div></Panel>}
          <Panel title="Comprobantes electrónicos" subtitle="El ticket interno no es boleta ni factura electrónica SUNAT."><p className="mb-3 text-sm">Estado: <strong>{fiscal?.enabled ? 'Adaptador configurado' : 'Sin proveedor configurado'}</strong>. No se envían ni aceptan documentos fiscales desde esta entrega.</p><ul className="list-disc space-y-1 pl-5 text-sm text-slate-500 dark:text-slate-400">{fiscal?.missing?.map(item => <li key={item}>{item}</li>)}</ul>{isAdmin && <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={config.allowMixed} onChange={e => api.pos.setConfig({ allowMixed: e.target.checked }, token).then(() => refresh()).catch(error => notify(error.message, 'error'))} />Permitir pagos combinados (métodos activos en Admin → Métodos de pago).</label>}</Panel>
        </>}
      </main>
      {section === 'venta' && (cart.length > 0 || webOrder) && <div className="pos-mobile-checkout"><span><small>Total a cobrar</small><strong>{sol(amount(total))}</strong></span><a href="#pos-checkout" className="pos-primary">Ir al cobro</a></div>}
  </div></WorkspaceShell>
}
