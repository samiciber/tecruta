import { cents, amount } from '../../../src/utils/posMoney.js'
import { InventoryError } from './inventoryService.js'

export function limaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function limaRange(filters) {
  const from = new Date(`${filters.from ?? limaDay()}T00:00:00-05:00`)
  const to = new Date(`${filters.to ?? limaDay()}T23:59:59.999-05:00`)
  if (from > to) throw new InventoryError(400, 'La fecha inicial debe ser anterior a la final.')
  return { gte: from, lte: to }
}
const value = input => cents(String(input))
const sum = (rows, field) => amount(rows.reduce((total, row) => total + value(row[field]), 0n))
export async function posReport(db, user, filters) {
  const userId = user.role === 'ADMIN' ? filters.userId : user.id
  const range = limaRange(filters)
  const saleWhere = { confirmedAt: range, ...(userId ? { userId } : {}),
    ...(filters.productId ? { items: { some: { productId: filters.productId } } } : {}),
    ...(filters.method ? { payments: { some: { method: filters.method, status: 'CONFIRMED' } } } : {}) }
  let rows
  switch (filters.type) {
    case 'payments':
      rows = (await db.posPayment.findMany({ where: { status: 'CONFIRMED', confirmedAt: range,
        ...(filters.method ? { method: filters.method } : {}),
        ...(userId ? { confirmedById: userId } : {}),
        ...(filters.productId ? { sale: { items: { some: { productId: filters.productId } } } } : {}) },
        include: { sale: { select: { orderId: true } } }, orderBy: { confirmedAt: 'desc' }, take: 10001,
      })).map(row => ({ id: row.id, saleId: row.saleId, orderId: row.sale.orderId, userId: row.confirmedById, sessionId: row.sessionId,
        fecha: row.confirmedAt, method: row.method, amount: String(row.amount), received: String(row.received), change: String(row.change), reference: row.reference }))
      break
    case 'products': {
      const items = await db.posSaleItem.findMany({ where: { sale: saleWhere, ...(filters.productId ? { productId: filters.productId } : {}) }, include: { returns: true }, take: 10001 })
      if (items.length > 10000) throw new InventoryError(422, 'Reduce el rango del reporte: máximo 10 000 líneas.')
      const grouped = new Map()
      for (const line of items) {
        const row = grouped.get(line.productId) ?? { productId: line.productId, sku: line.sku, name: line.name, quantity: 0, returned: 0, gross: 0n, refunded: 0n }
        row.quantity += line.quantity; row.returned += line.returns.reduce((sum, item) => sum + item.quantity, 0)
        row.gross += value(line.lineTotal); row.refunded += line.returns.reduce((sum, item) => sum + value(item.amount), 0n)
        grouped.set(line.productId, row)
      }
      rows = [...grouped.values()].map(row => ({ ...row, gross: amount(row.gross), refunded: amount(row.refunded), net: amount(row.gross - row.refunded), historicalCost: null, profit: null }))
      break
    }
    case 'refunds':
      rows = (await db.posRefund.findMany({ where: { createdAt: range, ...(userId ? { userId } : {}),
        ...(filters.method ? { method: filters.method } : {}), ...(filters.productId ? { items: { some: { saleItem: { productId: filters.productId } } } } : {}) },
        orderBy: { createdAt: 'desc' }, take: 10001,
      })).map(row => ({ id: row.id, saleId: row.saleId, userId: row.userId, fecha: row.createdAt, method: row.method, amount: String(row.amount), reason: row.reason, reference: row.reference, kind: row.kind, sessionId: row.sessionId }))
      break
    case 'cash':
      rows = (await db.cashSession.findMany({ where: { openedAt: range, ...(userId ? { userId } : {}) }, orderBy: { openedAt: 'desc' }, take: 10001 }))
        .map(row => ({ id: row.id, userId: row.userId, status: row.status, openedAt: row.openedAt, closedAt: row.closedAt, opening: String(row.openingAmount), expected: row.expectedAmount?.toString() ?? null, counted: row.countedAmount?.toString() ?? null, difference: row.difference?.toString() ?? null, note: row.closingNote }))
      break
    case 'low-stock':
      rows = (await db.product.findMany({ where: { stock: { lte: 5 }, ...(filters.productId ? { id: filters.productId } : {}) }, select: { id: true, sku: true, name: true, stock: true }, orderBy: { stock: 'asc' }, take: 10001 }))
      break
    default:
      rows = (await db.posSale.findMany({ where: saleWhere, orderBy: { confirmedAt: 'desc' }, include: { refunds: true }, take: 10001 }))
        .map(row => {
          const refunded = row.refunds.reduce((sum, refund) => sum + value(refund.amount), 0n)
          return { id: row.id, userId: row.userId, orderId: row.orderId, fecha: row.confirmedAt, status: row.status, customer: row.customerName || 'Consumidor final', subtotal: String(row.subtotal), discount: String(row.discount), total: String(row.total), refunded: amount(refunded), net: amount(value(row.total) - refunded), approvedById: row.approvedById, historicalCost: null, profit: null }
        })
  }
  if (rows.length > 10000) throw new InventoryError(422, 'Reduce los filtros: el reporte supera 10 000 registros.')
  rows = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date
    ? value.toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false }) + ' -05:00' : value])))
  return { timeZone: 'America/Lima', from: range.gte, to: range.lte, type: filters.type, rows,
    totals: filters.type === 'sales' ? { total: sum(rows, 'total'), refunded: sum(rows, 'refunded'), net: sum(rows, 'net') } : {},
    costs: 'Costos históricos no consolidados: no se calcula utilidad. Devoluciones por fecha de venta en ventas/productos; por fecha del reembolso en devoluciones.' }
}
export function reportCsv(report) {
  const headers = report.rows.length ? Object.keys(report.rows[0]) : ['sin_resultados']
  const quote = input => {
    const text = input instanceof Date ? input.toISOString() : String(input ?? '')
    return `"${(/^[=+\-@\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`
  }
  return '\uFEFF' + [headers.map(quote).join(','), ...report.rows.map(row => headers.map(key => quote(row[key])).join(','))].join('\r\n')
}
