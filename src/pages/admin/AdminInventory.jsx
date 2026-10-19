import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, Download, PackageSearch, Printer, RotateCcw, ScanLine, Search, Trash2 } from 'lucide-react'
import { useWorkspacePreference, useWorkspaceScroll } from '../../hooks/useWorkspaceMemory.js'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'
import { code128 } from '../../utils/inventoryLabels.js'
import { formatCurrency } from '../../utils/formatCurrency.js'

const MOVEMENT_TYPES = [
  ['PURCHASE', 'Compra'],
  ['CUSTOMER_RETURN', 'Devolución de cliente'],
  ['POSITIVE_ADJUSTMENT', 'Ajuste positivo'],
  ['LOSS', 'Pérdida'],
  ['DAMAGE', 'Daño'],
  ['SUPPLIER_RETURN', 'Devolución a proveedor'],
  ['NEGATIVE_ADJUSTMENT', 'Ajuste negativo'],
]
const TYPE_LABEL = Object.fromEntries([
  ...MOVEMENT_TYPES,
  ['INITIAL_BALANCE', 'Saldo inicial'],
  ['WEB_ORDER', 'Pedido web'],
  ['WEB_CANCELLATION', 'Cancelación web'],
  ['POS_SALE', 'Venta presencial'],
  ['POS_RETURN', 'Devolución POS'],
  ['REVERSAL', 'Reversión'],
])

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function barcodeSvg(value) {
  const { bars, width } = code128(value)
  return `<svg role="img" aria-label="Código ${escapeHtml(value)}" viewBox="0 0 ${width} 48" preserveAspectRatio="none" style="width:${(width * 0.254).toFixed(2)}mm" class="barcode">${bars.map(bar => `<rect x="${bar.x}" y="0" width="${bar.width}" height="48"/>`).join('')}</svg>`
}

function printLabels(products, showPrice, printWindow) {
  const labels = products.flatMap(product => {
    const codes = product.barcodes.length
      ? product.barcodes.map(barcode => /^[\x20-\x7e]{1,40}$/.test(barcode.code) ? barcode.code : product.sku)
      : product.sku ? [product.sku] : []
    return codes.map(code => ({ ...product, code }))
  })
  if (!labels.length) throw new Error('No hay SKU ni códigos para imprimir en la selección.')
  const content = labels.map(label => `<article class="label"><div class="name">${escapeHtml(label.name)}</div>${barcodeSvg(label.code)}<div class="code">${escapeHtml(label.code)}</div>${showPrice ? `<div class="price">${escapeHtml(formatCurrency(label.price))}</div>` : ''}</article>`).join('')
  if (!printWindow) throw new Error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para imprimir etiquetas.')
  printWindow.opener = null
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas TecRuta</title>
    <style>
      @page{size:auto;margin:8mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#111}
      .grid{display:grid;grid-template-columns:1fr;gap:5mm}
      .label{min-height:36mm;border:1px dashed #777;padding:3mm;break-inside:avoid;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
      .name{font-weight:700;font-size:11px;line-height:1.2;max-height:2.4em;overflow:hidden}
      .barcode{display:block;max-width:100%;height:13mm;fill:#111}
      .code{font:10px monospace;letter-spacing:.6px;overflow-wrap:anywhere}
      .price{font-size:13px;font-weight:700}
      @media print{.label{border-color:#bbb}}
    </style></head><body><div class="grid">${content}</div>
    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150))</script></body></html>`)
  printWindow.document.close()
}

function localDateToIso(date, end = false) {
  if (!date) return undefined
  return new Date(`${date}T${end ? '23:59:59.999' : '00:00:00.000'}-05:00`).toISOString()
}

function Panel({ children, className = '', id }) {
  return <section id={id} className={`rounded-xl2 border border-paper-line bg-paper-surface p-4 dark:border-night-line dark:bg-night-surface sm:p-5 ${className}`}>{children}</section>
}

export default function AdminInventory() {
  const { token, user } = useAuth()
  const toast = useContext(ToastContext)
  const scannerRef = useRef(null)
  const draftRequestId = useRef(crypto.randomUUID())
  const scanQueue = useRef(Promise.resolve())
  const lastScannedProduct = useRef(null)
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [operators, setOperators] = useState([])
  const [drafts, setDrafts] = useState([])
  const [movements, setMovements] = useState([])
  const [movementTotal, setMovementTotal] = useState(0)
  const [page, setPage] = useWorkspacePreference('inventory-ledger-page', 1, value => Number.isSafeInteger(value) && value > 0)
  const [productPage, setProductPage] = useWorkspacePreference('inventory-products-page', 1, value => Number.isSafeInteger(value) && value > 0)
  const [productSearch, setProductSearch] = useWorkspacePreference('inventory-search', new URLSearchParams(location.search).get('buscar') || '')
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get('buscar'); if (requested !== null) setProductSearch(requested) }, [])
  const [scannerValue, setScannerValue] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [filters, setFilters] = useWorkspacePreference('inventory-filters', { productId: '', type: '', userId: '', from: '', to: '' }, value => value && ['productId','type','userId','from','to'].every(key => typeof value[key] === 'string'))
  const [barcodeDraft, setBarcodeDraft] = useState({ code: '', kind: 'MANUFACTURER' })
  const [movementDraft, setMovementDraft] = useState({
    type: 'PURCHASE', quantity: '1', reason: '', reference: '', supplier: '', unitCost: '', occurredAt: '',
  })
  const [busy, setBusy] = useState(false)
  const [includePrice, setIncludePrice] = useState(true)
  const canManage = ['ADMIN', 'WAREHOUSE'].includes(user?.role)
  useWorkspaceScroll(Boolean(summary))
  const pageSize = 50

  const loadProducts = useCallback(async (q = productSearch) => {
    const result = await api.inventory.listProducts({ q, page: productPage, pageSize }, token)
    setProducts(result.rows)
    setTotalProducts(result.total)
  }, [productSearch, productPage, token])

  const movementParams = useMemo(() => ({
    productId: filters.productId || undefined,
    type: filters.type || undefined,
    userId: filters.userId || undefined,
    from: localDateToIso(filters.from),
    to: localDateToIso(filters.to, true),
    page,
    pageSize,
  }), [filters, page])

  const loadMovements = useCallback(async () => {
    const result = await api.inventory.listMovements(movementParams, token)
    setMovements(result.rows)
    setMovementTotal(result.total)
  }, [movementParams, token])

  const refresh = useCallback(async () => {
    const tasks = [
      api.inventory.getSummary(token).then(setSummary),
      loadProducts(),
      loadMovements(),
    ]
    tasks.push(api.inventory.listOperators(token).then(setOperators))
    if (canManage) tasks.push(api.inventory.listDrafts(token).then(setDrafts))
    await Promise.all(tasks)
  }, [canManage, loadMovements, loadProducts, token])

  useEffect(() => {
    refresh().catch(error => toast?.showToast(error.message, 'error'))
  }, [refresh])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts(productSearch).catch(error => toast?.showToast(error.message, 'error'))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [productSearch, loadProducts, toast])

  useEffect(() => {
    loadMovements().catch(error => toast?.showToast(error.message, 'error'))
  }, [loadMovements, toast])

  const applyLookup = code => {
    const cleaned = code.trim()
    if (!cleaned) return
    setScannerValue('')
    scanQueue.current = scanQueue.current.then(async () => {
      try {
        const product = await api.inventory.lookup(cleaned, token)
        const repeated = lastScannedProduct.current === product.id
        lastScannedProduct.current = product.id
        setSelectedProduct(product)
        setMovementDraft(draft => ({ ...draft, quantity: repeated && draft.type === 'PURCHASE' ? String(Number(draft.quantity || 0) + 1) : '1' }))
        setProductSearch('')
        setProductPage(1)
        toast?.showToast(`Producto identificado: ${product.name}. Revisa el movimiento antes de guardarlo.`, 'success')
      } catch (error) {
        lastScannedProduct.current = null
        setProductSearch(cleaned)
        setSelectedProduct(null)
        toast?.showToast(error.message, 'error')
      }
    })
  }

  useEffect(() => {
    setSelectedProduct(current => products.find(product => product.id === current?.id) ?? current)
  }, [products])

  const selectProduct = product => {
    lastScannedProduct.current = null
    setSelectedProduct(product)
    setMovementDraft(draft => ({ ...draft, quantity: '1' }))
  }

  const handleAddBarcode = async event => {
    event.preventDefault()
    if (!selectedProduct) return
    setBusy(true)
    try {
      await api.inventory.addBarcode(selectedProduct.id, barcodeDraft, token)
      const refreshed = await api.inventory.lookup(barcodeDraft.code, token)
      setSelectedProduct(refreshed)
      await loadProducts()
      setBarcodeDraft({ code: '', kind: 'MANUFACTURER' })
      toast?.showToast('Código agregado y asociado al producto.', 'success')
    } catch (error) {
      toast?.showToast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveBarcode = async barcode => {
    if (!selectedProduct || !window.confirm(`¿Quitar el código ${barcode.code}?`)) return
    setBusy(true)
    try {
      await api.inventory.removeBarcode(selectedProduct.id, barcode.id, token)
      setSelectedProduct(product => ({ ...product, barcodes: product.barcodes.filter(row => row.id !== barcode.id) }))
      await loadProducts()
      toast?.showToast('Código eliminado.', 'success')
    } catch (error) {
      toast?.showToast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateDraft = async event => {
    event.preventDefault()
    if (!selectedProduct) {
      toast?.showToast('Selecciona un producto mediante el lector o la búsqueda manual.', 'error')
      return
    }
    setBusy(true)
    try {
      const payload = {
        ...movementDraft,
        requestId: draftRequestId.current,
        productId: selectedProduct.id,
        quantity: Number(movementDraft.quantity),
        unitCost: movementDraft.unitCost === '' ? null : Number(movementDraft.unitCost),
        occurredAt: movementDraft.occurredAt ? new Date(movementDraft.occurredAt).toISOString() : undefined,
      }
      await api.inventory.createMovement(payload, token)
      draftRequestId.current = crypto.randomUUID()
      setMovementDraft(draft => ({ ...draft, quantity: '1', reason: '', reference: '', supplier: '', unitCost: '', occurredAt: '' }))
      const nextDrafts = await api.inventory.listDrafts(token)
      setDrafts(nextDrafts)
      toast?.showToast('Borrador guardado. El stock no cambia hasta confirmarlo.', 'success')
    } catch (error) {
      toast?.showToast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmDraft = async draft => {
    if (!window.confirm(`Confirmar ${TYPE_LABEL[draft.type].toLowerCase()} de ${draft.quantity} unidad(es) de ${draft.product.name}?`)) return
    setBusy(true)
    try {
      await api.inventory.confirmMovement(draft.id, token)
      await refresh()
      toast?.showToast('Movimiento confirmado; el stock y el Kardex se actualizaron.', 'success')
    } catch (error) {
      toast?.showToast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteDraft = async draft => {
    if (!window.confirm('¿Eliminar este borrador? No afecta el stock.')) return
    try {
      await api.inventory.deleteMovementDraft(draft.id, token)
      setDrafts(rows => rows.filter(row => row.id !== draft.id))
      toast?.showToast('Borrador eliminado.', 'success')
    } catch (error) {
      toast?.showToast(error.message, 'error')
    }
  }

  const handleReverse = async movement => {
    const reason = window.prompt(`Motivo para revertir el movimiento ${movement.id}:`)
    if (!reason?.trim()) return
    setBusy(true)
    try {
      await api.inventory.reverseMovement(movement.id, reason.trim(), token)
      await refresh()
      toast?.showToast('Reversión confirmada y enlazada al movimiento original.', 'success')
    } catch (error) {
      toast?.showToast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await api.inventory.exportMovements(movementParams, token)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'kardex-tecruta.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast?.showToast(error.message, 'error')
    }
  }

  const handlePrint = async () => {
    let printWindow
    try {
      const ids = [...new Set(selectedLabels)]
      if (!ids.length) throw new Error('Selecciona al menos un producto para imprimir etiquetas.')
      if (ids.length > 50) throw new Error('Selecciona hasta 50 productos por impresión.')
      printWindow = window.open('', '_blank')
      if (!printWindow) throw new Error('Permite ventanas emergentes para imprimir etiquetas.')
      printWindow.opener = null
      printWindow.document.body.textContent = 'Preparando etiquetas…'
      printLabels(await api.inventory.getLabels(ids, token), includePrice, printWindow)
    } catch (error) {
      printWindow?.close()
      toast?.showToast(error.message, 'error')
    }
  }

  const [selectedLabels, setSelectedLabels] = useState([])
  const allVisibleSelected = products.length > 0 && products.every(product => selectedLabels.includes(product.id))
  const updateFilter = (field, value) => {
    setPage(1)
    setFilters(current => ({ ...current, [field]: value }))
  }

  return (
    <div className="space-y-5 [&_input]:placeholder:text-ink-soft/60 dark:[&_input]:placeholder:text-paper/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="workspace-eyebrow">Almacén principal</p>
          <h1 className="mb-2 text-3xl font-bold">Inventario</h1>
          <p className="text-sm text-ink-soft dark:text-paper/60">Consulta existencias, identifica productos y conserva el historial de cada operación.</p>
          <p className="mt-1 text-xs text-ink-soft dark:text-paper/50">Perfil: {user?.role === 'ADMIN' ? 'administrador' : user?.role === 'WAREHOUSE' ? 'almacén' : 'vendedor / cajero'} · almacén principal</p>
        </div>
        <button type="button" onClick={() => refresh().catch(error => toast?.showToast(error.message, 'error'))} className="btn-secondary inline-flex items-center justify-center gap-2 self-start">
          <RotateCcw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      <nav aria-label="Tareas de inventario" className="flex flex-wrap gap-2">
        <a href="#inventory-products" className="btn-secondary">Consultar productos y etiquetas</a>
        {canManage && <><button className="btn-primary" onClick={() => { setMovementDraft(row => ({ ...row, type: 'PURCHASE' })); scannerRef.current?.focus() }}>Registrar entrada</button><button className="btn-secondary" onClick={() => { setMovementDraft(row => ({ ...row, type: 'LOSS' })); scannerRef.current?.focus() }}>Registrar salida</button><a href="#inventory-drafts" className="btn-secondary">Borradores ({summary?.drafts ?? drafts.length})</a></>}
        <a href="#inventory-kardex" className="btn-secondary">Consultar Kardex</a>
      </nav>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Productos', summary?.productCount],
          ['Unidades disponibles', summary?.unitsOnHand],
          ['Stock bajo (≤ 5)', summary?.lowStock],
          ['Sin stock', summary?.outOfStock],
        ].map(([label, value]) => (
          <Panel key={label} className="p-4">
            <p className="text-xs font-medium text-ink-soft dark:text-paper/60">{label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-ink dark:text-paper">{value ?? '—'}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <Panel id="inventory-operation">
          <div className="mb-4 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-route" />
            <h2 className="font-display text-lg font-bold text-ink dark:text-paper">Lector y movimiento</h2>
          </div>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-ink dark:text-paper">Escanea un SKU o código de barras</span>
            <div className="flex gap-2">
              <input
                ref={scannerRef}
                value={scannerValue}
                onChange={event => setScannerValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.repeat) {
                    event.preventDefault()
                    applyLookup(scannerValue)
                  }
                }}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
                className="input-tr min-w-0 flex-1 font-mono"
                placeholder="Enfoca aquí; el lector confirma con Enter"
                aria-describedby="scanner-hint"
              />
              <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => { scannerRef.current?.focus(); applyLookup(scannerValue) }}>
                <Barcode className="h-4 w-4" /><span className="hidden sm:inline">Buscar código</span>
              </button>
            </div>
            <span id="scanner-hint" className="mt-1 block text-xs text-ink-soft dark:text-paper/50">El lector solo identifica el producto; nunca confirma un movimiento.</span>
          </label>

          {selectedProduct && (
            <div className="mb-4 rounded-lg border border-route/30 bg-route-soft/40 p-3 dark:bg-route-softDark/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink dark:text-paper">{selectedProduct.name}</p>
                  <p className="font-mono text-xs text-ink-soft dark:text-paper/60">{selectedProduct.sku || 'Sin SKU'} · Stock actual: {selectedProduct.stock}</p>
                </div>
                <button type="button" className="text-xs font-semibold text-route" onClick={() => setSelectedProduct(null)}>Quitar</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedProduct.barcodes || []).map(barcode => (
                  <span key={barcode.id} className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 font-mono text-xs text-ink dark:bg-night">
                    {barcode.code} <span className="font-sans text-ink-soft dark:text-paper/50">{barcode.kind === 'INTERNAL' ? 'interno' : 'fabricante'}</span>
                    {canManage && <button type="button" disabled={busy} onClick={() => handleRemoveBarcode(barcode)} aria-label={`Quitar código ${barcode.code}`} className="ml-1 text-signal-red">×</button>}
                  </span>
                ))}
              </div>
              {canManage && (
                <form onSubmit={handleAddBarcode} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input value={barcodeDraft.code} onChange={event => setBarcodeDraft(row => ({ ...row, code: event.target.value }))} className="input-tr font-mono" maxLength={128} placeholder="Código en texto (conserva ceros iniciales)" required />
                  <select value={barcodeDraft.kind} onChange={event => setBarcodeDraft(row => ({ ...row, kind: event.target.value }))} className="input-tr">
                    <option value="MANUFACTURER">Fabricante</option>
                    <option value="INTERNAL">Interno</option>
                  </select>
                  <button type="submit" disabled={busy} className="btn-secondary">Agregar código</button>
                </form>
              )}
            </div>
          )}

          {canManage ? (
            <form onSubmit={handleCreateDraft} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink dark:text-paper">
                Tipo
                <select value={movementDraft.type} onChange={event => setMovementDraft(row => ({ ...row, type: event.target.value }))} className="input-tr mt-1 w-full">
                  {MOVEMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink dark:text-paper">
                Cantidad
                <input type="number" min="1" step="1" required value={movementDraft.quantity} onChange={event => setMovementDraft(row => ({ ...row, quantity: event.target.value }))} className="input-tr mt-1 w-full" />
              </label>
              <label className="text-sm text-ink dark:text-paper sm:col-span-2">
                Motivo
                <input required maxLength={240} value={movementDraft.reason} onChange={event => setMovementDraft(row => ({ ...row, reason: event.target.value }))} className="input-tr mt-1 w-full" placeholder="Describe por qué se registra la entrada o salida" />
              </label>
              <label className="text-sm text-ink dark:text-paper">
                Referencia
                <input maxLength={120} value={movementDraft.reference} onChange={event => setMovementDraft(row => ({ ...row, reference: event.target.value }))} className="input-tr mt-1 w-full" placeholder="Documento, boleta u observación" />
              </label>
              <label className="text-sm text-ink dark:text-paper">
                Fecha del movimiento
                <input type="datetime-local" value={movementDraft.occurredAt} onChange={event => setMovementDraft(row => ({ ...row, occurredAt: event.target.value }))} className="input-tr mt-1 w-full" />
              </label>
              {movementDraft.type === 'PURCHASE' && (
                <>
                  <label className="text-sm text-ink dark:text-paper">
                    Proveedor (opcional)
                    <input maxLength={120} value={movementDraft.supplier} onChange={event => setMovementDraft(row => ({ ...row, supplier: event.target.value }))} className="input-tr mt-1 w-full" />
                  </label>
                  <label className="text-sm text-ink dark:text-paper">
                    Costo unitario real (opcional)
                    <input type="number" min="0" step="0.01" value={movementDraft.unitCost} onChange={event => setMovementDraft(row => ({ ...row, unitCost: event.target.value }))} className="input-tr mt-1 w-full" />
                  </label>
                </>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button type="submit" disabled={busy} className="btn-primary">Guardar borrador</button>
                <span className="text-xs text-ink-soft dark:text-paper/50">El stock cambia solo al confirmar explícitamente el borrador.</span>
              </div>
            </form>
          ) : (
            <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft dark:bg-night dark:text-paper/60">Perfil de consulta: puedes escanear y revisar existencias, pero no registrar movimientos ni modificar códigos.</p>
          )}
        </Panel>

        <Panel id="inventory-products">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-route" />
              <h2 className="font-display text-lg font-bold text-ink dark:text-paper">Productos</h2>
            </div>
            <span className="text-xs text-ink-soft dark:text-paper/50">{totalProducts} en catálogo</span>
          </div>
          <label className="relative mb-3 block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft dark:text-paper/50" />
            <input value={productSearch} onChange={event => { setProductSearch(event.target.value); setProductPage(1) }} className="input-tr pl-9" placeholder="Buscar nombre o SKU" />
          </label>
          <div className="max-h-[390px] overflow-auto rounded-lg border border-paper-line dark:border-night-line">
            <table className="w-full min-w-[510px] text-left text-sm">
              <thead className="sticky top-0 bg-paper dark:bg-night">
                <tr className="border-b border-paper-line dark:border-night-line">
                  {canManage && <th className="px-2 py-2"><input type="checkbox" aria-label="Seleccionar todos los productos visibles" checked={allVisibleSelected} onChange={event => setSelectedLabels(event.target.checked ? Array.from(new Set([...selectedLabels, ...products.map(product => product.id)])) : selectedLabels.filter(id => !products.some(product => product.id === id)))} /></th>}
                  <th className="px-2 py-2 font-semibold">Producto</th>
                  <th className="px-2 py-2 font-semibold">SKU / códigos</th>
                  <th className="px-2 py-2 text-right font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className={`cursor-pointer border-b border-paper-line last:border-0 hover:bg-paper dark:border-night-line dark:hover:bg-night ${selectedProduct?.id === product.id ? 'bg-route-soft/40 dark:bg-route-softDark/30' : ''}`} onClick={() => selectProduct(product)}>
                    {canManage && <td className="px-2 py-2" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar etiqueta de ${product.name}`} checked={selectedLabels.includes(product.id)} onChange={event => setSelectedLabels(ids => event.target.checked ? [...new Set([...ids, product.id])] : ids.filter(id => id !== product.id))} /></td>}
                    <td className="max-w-[190px] px-2 py-2">
                      <span className="block truncate font-medium text-ink dark:text-paper">{product.name}</span>
                      <span className="text-xs text-ink-soft dark:text-paper/50">{product.brand || 'Sin marca'}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-ink-soft dark:text-paper/60">
                      <span className="block">{product.sku || '—'}</span>
                      <span>{product.barcodes.map(row => row.code).join(', ') || 'Sin códigos'}</span>
                    </td>
                    <td className={`px-2 py-2 text-right font-mono font-bold ${product.stock <= 0 ? 'text-signal-red' : product.stock <= 5 ? 'text-signal-amber' : 'text-ink dark:text-paper'}`}>{product.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!products.length && <p className="p-4 text-sm text-ink-soft dark:text-paper/60">No hay resultados para esta búsqueda.</p>}
          </div>
          {totalProducts > pageSize && <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-soft dark:text-paper/60">
            <span>Página {productPage} de {Math.ceil(totalProducts / pageSize)}</span>
            <div className="flex gap-2">
              <button type="button" disabled={productPage <= 1} onClick={() => setProductPage(value => value - 1)} className="btn-secondary">Productos anteriores</button>
              <button type="button" disabled={productPage >= Math.ceil(totalProducts / pageSize)} onClick={() => setProductPage(value => value + 1)} className="btn-secondary">Más productos</button>
            </div>
          </div>}
          {canManage && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-paper/60">
                <input type="checkbox" checked={includePrice} onChange={event => setIncludePrice(event.target.checked)} /> Incluir precio en etiqueta
              </label>
              <button type="button" onClick={handlePrint} className="btn-secondary inline-flex items-center gap-2">
                <Printer className="h-4 w-4" /> Imprimir etiquetas ({selectedLabels.length})
              </button>
            </div>
          )}
        </Panel>
      </div>

      {canManage && (
        <Panel id="inventory-drafts">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-ink dark:text-paper">Borradores pendientes</h2>
              <p className="text-xs text-ink-soft dark:text-paper/50">{summary?.drafts ?? drafts.length} sin confirmar; todavía no afectan existencias.</p>
            </div>
          </div>
          {drafts.length ? (
            <div className="space-y-2">
              {drafts.map(draft => (
                <div key={draft.id} className="flex flex-col gap-3 rounded-lg border border-paper-line p-3 dark:border-night-line sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-paper">{draft.product?.name || draft.productId} · {TYPE_LABEL[draft.type]} · {draft.quantity} u.</p>
                    <p className="text-xs text-ink-soft dark:text-paper/50">{draft.reason} · {draft.supplier || 'Sin proveedor'} · {draft.reference || 'Sin referencia'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => handleConfirmDraft(draft)} className="btn-primary">Confirmar</button>
                    <button type="button" disabled={busy} onClick={() => handleDeleteDraft(draft)} className="btn-secondary inline-flex items-center gap-1"><Trash2 className="h-4 w-4" />Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-ink-soft dark:text-paper/60">No hay borradores.</p>}
        </Panel>
      )}

      <Panel id="inventory-kardex">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink dark:text-paper">Kardex</h2>
            <p className="text-xs text-ink-soft dark:text-paper/50">Los saldos reflejan el stock al confirmar cada movimiento; el saldo inicial no incluye costos históricos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleExport} className="btn-secondary inline-flex items-center gap-2"><Download className="h-4 w-4" /> Exportar CSV</button>
          </div>
          <div className="grid w-full basis-full grid-cols-2 gap-2 lg:grid-cols-5">
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)} className="input-tr">
              <option value="">Todos los productos</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select value={filters.type} onChange={event => updateFilter('type', event.target.value)} className="input-tr">
              <option value="">Todos los movimientos</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {canManage && (
              <select value={filters.userId} onChange={event => updateFilter('userId', event.target.value)} className="input-tr">
                <option value="">Todos los usuarios</option>
                {operators.map(operator => <option key={operator.id} value={operator.id}>{operator.nombre} {operator.apellido}</option>)}
              </select>
            )}
            <input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} className="input-tr" aria-label="Desde fecha" />
            <input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} className="input-tr" aria-label="Hasta fecha" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-paper-line dark:border-night-line">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-soft dark:bg-night dark:text-paper/50">
              <tr>
                <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Movimiento</th>
                <th className="px-3 py-2">Motivo / referencia</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2">Usuario</th>{canManage && <th className="px-3 py-2">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {movements.map(movement => (
                <tr key={movement.id} className="border-t border-paper-line align-top dark:border-night-line">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-soft dark:text-paper/60">{new Date(movement.occurredAt).toLocaleString('es-PE')}</td>
                  <td className="px-3 py-2"><span className="font-medium text-ink dark:text-paper">{movement.product.name}</span><span className="block font-mono text-xs text-ink-soft dark:text-paper/50">{movement.product.sku || '—'}</span></td>
                  <td className="px-3 py-2 text-ink dark:text-paper">{TYPE_LABEL[movement.type]}<span className="block text-xs text-ink-soft dark:text-paper/50">{movement.direction === 'IN' ? 'Entrada' : 'Salida'}</span></td>
                  <td className="max-w-[240px] px-3 py-2 text-ink-soft dark:text-paper/60">{movement.reason}<span className="block text-xs">{movement.reference || movement.supplier || '—'}</span>{movement.reversalOf && <span className="block text-xs text-route">Revierte {movement.reversalOf.id}</span>}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${movement.direction === 'IN' ? 'text-signal-green' : 'text-signal-red'}`}>{movement.direction === 'IN' ? '+' : '−'}{movement.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-ink dark:text-paper">{movement.balanceAfter ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-ink-soft dark:text-paper/60">{movement.createdBy ? `${movement.createdBy.nombre} ${movement.createdBy.apellido}` : 'Sistema'}</td>
                  {canManage && <td className="px-3 py-2">{!['INITIAL_BALANCE', 'REVERSAL', 'WEB_ORDER', 'WEB_CANCELLATION', 'POS_SALE', 'POS_RETURN'].includes(movement.type) && !movement.sourceKey?.startsWith('pos-') && !movement.reversals?.length && <button type="button" disabled={busy} onClick={() => handleReverse(movement)} className="text-xs font-semibold text-route hover:underline">Revertir</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!movements.length && <p className="p-4 text-sm text-ink-soft dark:text-paper/60">No hay movimientos para los filtros seleccionados.</p>}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-ink-soft dark:text-paper/60">
          <span>{movementTotal} movimiento(s) · Página {page} de {Math.max(1, Math.ceil(movementTotal / pageSize))}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="btn-secondary">Anterior</button>
            <button type="button" disabled={page >= Math.ceil(movementTotal / pageSize)} onClick={() => setPage(value => value + 1)} className="btn-secondary">Siguiente</button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
