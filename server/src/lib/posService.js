import { createHash } from 'node:crypto'
import { cents, amount, returnCents } from '../../../src/utils/posMoney.js'
import { recordConfirmedMovement, InventoryError } from './inventoryService.js'
import {audit} from './staffSecurity.js'

export const saleInclude = {
  items: { include: { returns: true }, orderBy: { id: 'asc' } },
  payments: true, refunds: { include: { items: true }, orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, nombre: true, apellido: true } },
  approvedBy: { select: { id: true, nombre: true, apellido: true } },
}
const fail = (status, message) => { throw new InventoryError(status, message) }
const json = value => JSON.parse(JSON.stringify(value))
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const admin = user => { if (user.role !== 'ADMIN') fail(403, 'Esta operación requiere un administrador.') }
const cashMethod = 'cashOnDelivery'
const money = value => cents(String(value))
const bounded = value => { if (value < 0n || value > 999999999999n) fail(400, 'El importe supera el rango permitido.'); return value }

// El registro de operación y todos sus efectos se confirman en una sola transacción.
export async function posOperation(db, user, kind, input, work) {
  if (!['ADMIN', 'CASHIER'].includes(user.role)) fail(403, 'No tienes permiso para usar el POS.')
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId ?? '')) fail(400, 'Falta requestId UUID.')
  const hash = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex')
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pos:${input.requestId}`}, 0))`
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`
    const actor = await tx.user.findUnique({where:{id:user.id}})
    if (!actor || actor.isSuspended || actor.mustChangePassword || actor.role !== user.role || (actor.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) fail(403,'Tu autorización cambió. Inicia sesión nuevamente.')
    const previous = await tx.posOperation.findUnique({ where: { id: input.requestId } })
    if (previous) {
      if (previous.userId !== user.id || previous.kind !== kind || previous.requestHash !== hash) fail(409, 'La clave ya pertenece a otra operación. No se repitió el cobro.')
      return previous.response
    }
    const response = json(await work(tx))
    await tx.posOperation.create({ data: { id: input.requestId, userId: user.id, kind, requestHash: hash, response } })
    return response
  }, { maxWait: 10000, timeout: 20000 })
}

export async function cashBalance(tx, session) {
  const aggregate = await tx.cashEntry.aggregate({ where: { sessionId: session.id }, _sum: { amount: true } })
  // La suma puede ser negativa; Decimal se convierte a céntimos sin float.
  const value = String(aggregate._sum.amount ?? '0')
  const signed = value.startsWith('-') ? -money(value.slice(1)) : money(value)
  return money(session.openingAmount) + signed
}
async function lockCash(tx, id, user) {
  await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${id} FOR UPDATE`
  const session = await tx.cashSession.findUnique({ where: { id } })
  if (!session || session.userId !== user.id) fail(403, 'Debes usar tu propia caja.')
  if (session.status !== 'OPEN') fail(409, 'La caja está cerrada. Abre un nuevo turno.')
  return session
}
async function cashEntry(tx, session, user, delta, kind, reason, sourceKey, reference = null) {
  const balance = await cashBalance(tx, session)
  if (balance + delta < 0n) fail(409, 'No hay efectivo suficiente en esta caja.')
  if (balance + delta > 999999999999n) fail(409, 'El efectivo del turno supera el máximo permitido; concilia y registra un retiro autorizado.')
  return tx.cashEntry.create({ data: { sessionId: session.id, userId: user.id, kind, amount: amount(delta), reason, sourceKey, reference } })
}
export function openCash(db, user, input) {
  return posOperation(db, user, 'OPEN_CASH', input, async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`
    const currentUser = await tx.user.findUnique({ where: { id: user.id } })
    if (!currentUser || !['ADMIN', 'CASHIER'].includes(currentUser.role) || (currentUser.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) fail(403, 'Tu autorización cambió. Inicia sesión nuevamente.')
    if (await tx.cashSession.findFirst({ where: { userId: user.id, status: 'OPEN' } })) fail(409, 'Ya tienes un turno abierto.')
    return tx.cashSession.create({ data: { userId: user.id, openingAmount: input.openingAmount } })
  })
}
export function manualCash(db, user, id, input) {
  admin(user)
  return posOperation(db, user, `MANUAL_CASH:${id}`, input, async tx => {
    const session = await lockCash(tx, id, user)
    const value = money(input.amount)
    if (!value) fail(400, 'El importe debe ser mayor que cero.')
    return cashEntry(tx, session, user, input.direction === 'IN' ? value : -value, `MANUAL_${input.direction}`, input.reason, `pos-manual:${input.requestId}`)
  })
}

export function reconcileSuspendedCash(db,user,id,input) {
 admin(user)
 return posOperation(db,user,`RECONCILE_CASH:${id}`,input,async tx=>{
  await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id=${id} FOR UPDATE`
  const session=await tx.cashSession.findUnique({where:{id},include:{user:{select:{isSuspended:true}}}})
  if(!session||session.status!=='OPEN'||!session.user.isSuspended)fail(409,'Solo se concilian aquí turnos abiertos de personal suspendido.')
  const expected=await cashBalance(tx,session),counted=money(input.countedAmount)
  const updated=await tx.cashSession.update({where:{id},data:{status:'CLOSED',closedAt:new Date(),expectedAmount:amount(expected),countedAmount:amount(counted),difference:amount(counted-expected),closingNote:input.reason}})
  await audit(tx,user.id,'CASH_RECONCILED_BY_ADMIN',session.userId,{sessionId:id,reason:input.reason,expected:amount(expected),counted:amount(counted),difference:amount(counted-expected)})
  return updated
 })
}
export function closeCash(db, user, id, input) {
  return posOperation(db, user, `CLOSE_CASH:${id}`, input, async tx => {
    const session = await lockCash(tx, id, user)
    const expected = await cashBalance(tx, session), counted = money(input.countedAmount)
    return tx.cashSession.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), expectedAmount: amount(expected), countedAmount: amount(counted), difference: amount(counted - expected), closingNote: input.reason } })
  })
}

export async function paymentConfiguration(tx) {
  const methods = await tx.paymentMethod.findMany({ where: { active: true, key: { in: [cashMethod, 'yape', 'plin', 'bankTransfer'] } }, orderBy: { key: 'asc' } })
  const config = await tx.siteSetting.findUnique({ where: { key: 'posConfig' } })
  return { methods: methods.filter(row => row.config?.posEnabled !== false).map(row => ({ key: row.key, label: row.label })), allowMixed: config?.value?.allowMixed !== false }
}
async function paymentPlan(tx, payments, total, confirmed) {
  const config = await paymentConfiguration(tx), used = new Set()
  if (!config.allowMixed && payments.length > 1) fail(409, 'Los pagos combinados están desactivados.')
  let sum = 0n
  const rows = payments.map(payment => {
    if (used.has(payment.method)) fail(400, 'Agrupa los importes de cada método de pago.')
    used.add(payment.method)
    if (!config.methods.some(method => method.key === payment.method)) fail(409, 'Un método de pago está desactivado para POS.')
    const value = money(payment.amount)
    if (value <= 0n) fail(400, 'Cada pago debe ser mayor que cero.')
    if (confirmed && !payment.verified) fail(409, 'Confirma la recepción de cada pago. Una captura no verifica el dinero.')
    if (confirmed && payment.method !== cashMethod && !payment.reference?.trim()) fail(400, 'Registra la referencia verificada del pago digital.')
    const received = payment.method === cashMethod ? money(payment.received ?? payment.amount) : value
    if (received < value) fail(400, 'El efectivo recibido no alcanza el importe asignado.')
    sum += value
    return { method: payment.method, amount: amount(value), received: amount(received), change: amount(received - value), reference: payment.reference?.trim() || null, status: 'PENDING' }
  })
  if (confirmed && sum !== total) fail(400, 'Los pagos deben cubrir exactamente el total; el excedente de efectivo es vuelto.')
  if (!confirmed && sum > total) fail(400, 'El plan de pagos supera el total.')
  return rows
}

async function lockOrder(tx, id) {
  if (id) await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`
}
async function loadAndLockSale(tx, id) {
  const initial = await tx.posSale.findUnique({ where: { id }, select: { orderId: true } })
  if (!initial) fail(404, 'Venta no encontrada.')
  await lockOrder(tx, initial.orderId)
  await tx.$queryRaw`SELECT id FROM pos_sales WHERE id = ${id} FOR UPDATE`
  return tx.posSale.findUnique({ where: { id }, include: saleInclude })
}

async function confirm(tx, user, sale, input) {
  if (sale.status !== 'PENDING') fail(409, 'La venta ya fue confirmada o cancelada. Consulta el ticket existente.')
  if (user.role !== 'ADMIN' && sale.userId !== user.id) fail(403, 'Sólo puedes cobrar tus ventas pendientes.')
  const session = await lockCash(tx, input.sessionId, user)
  if (sale.orderId) {
    const order = await tx.order.findUnique({ where: { id: sale.orderId } })
    if (!['PENDING', 'CONFIRMED'].includes(order?.status)) fail(409, 'El pedido ya está pagado, cancelado o en despacho. No se puede volver a cobrar.')
    if (money(order.total) !== money(sale.total)) fail(409, 'El importe del pedido cambió.')
  } else {
    for (const line of [...sale.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${line.productId} FOR UPDATE`
      const product = await tx.product.findUnique({ where: { id: line.productId } })
      if (!product || money(product.price) !== money(line.unitPrice)) fail(409, `El precio de ${line.name} cambió. Revisa y actualiza la venta.`)
      await recordConfirmedMovement(tx, { productId: line.productId, type: 'POS_SALE', direction: 'OUT', quantity: line.quantity,
        reason: 'Venta presencial', reference: sale.id, createdById: user.id, sourceKey: `pos-sale:${sale.id}:${line.productId}` })
    }
  }
  const plan = await paymentPlan(tx, input.payments, money(sale.total), true)
  await tx.posPayment.deleteMany({ where: { saleId: sale.id, status: 'PENDING' } })
  const now = new Date()
  for (const payment of plan) {
    const row = await tx.posPayment.create({ data: { ...payment, saleId: sale.id, status: 'CONFIRMED', confirmedAt: now, confirmedById: user.id, sessionId: session.id } })
    if (payment.method === cashMethod) await cashEntry(tx, session, user, money(payment.amount), 'SALE_PAYMENT', 'Cobro de venta', `pos-payment:${row.id}`, sale.id)
  }
  await tx.posSale.update({ where: { id: sale.id }, data: { status: 'CONFIRMED', confirmedAt: now } })
  if (sale.orderId) await tx.order.update({ where: { id: sale.orderId }, data: { status: 'PAID', statusHistory: { create: { status: 'PAID', note: `Cobro registrado en POS: ${sale.id}` } } } })
  return tx.posSale.findUnique({ where: { id: sale.id }, include: saleInclude })
}

export function createSale(db, user, input) {
  return posOperation(db, user, 'CREATE_SALE', input, async tx => {
    await lockOrder(tx, input.orderId)
    await lockCash(tx, input.sessionId, user)
    let lines, customerName = input.customerName?.trim() || null, customerDocument = input.customerDocument?.trim() || null
    let subtotal = 0n, discount = money(input.discount)
    if (customerDocument && !customerName) fail(400, 'Indica el nombre del cliente identificado.')
    if (discount > 0n) { admin(user); if (!input.discountReason?.trim()) fail(400, 'Indica el motivo del descuento.') }
    if (input.orderId) {
      if (discount || input.items.length) fail(400, 'El cobro web conserva las líneas y el total del pedido original.')
      const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: { include: { product: { select: { sku: true } } } } } })
      if (!order) fail(404, 'Pedido no encontrado.')
      if (!['PENDING', 'CONFIRMED'].includes(order.status)) fail(409, 'Este pedido no está pendiente de pago.')
      if (await tx.posSale.findUnique({ where: { orderId: input.orderId } })) fail(409, 'Este pedido ya tiene una venta POS vinculada. Abre ese registro.')
      customerName = `${order.customerNombre} ${order.customerApellido}`; customerDocument = order.documento
      lines = order.items.map(line => ({ productId: line.productId, name: line.name, sku: line.product.sku, quantity: line.quantity, unitPrice: String(line.unitPrice), gross: money(line.unitPrice) * BigInt(line.quantity) }))
      subtotal = lines.reduce((sum, line) => sum + line.gross, 0n)
      if (subtotal !== money(order.total)) fail(409, 'El pedido requiere conciliación de importes antes de cobrarlo.')
    } else {
      if (!input.items.length) fail(400, 'Agrega productos a la venta.')
      const seen = new Set(); lines = []
      for (const item of [...input.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
        if (seen.has(item.productId)) fail(400, 'Agrupa las líneas repetidas antes de guardar.')
        seen.add(item.productId)
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product || product.stock < item.quantity) fail(409, 'Un producto no tiene existencias suficientes.')
        if (money(product.price) !== money(item.expectedPrice)) fail(409, 'Un precio cambió. Actualiza los productos antes de confirmar.')
        const gross = money(product.price) * BigInt(item.quantity)
        lines.push({ productId: product.id, name: product.name, sku: product.sku, quantity: item.quantity, unitPrice: String(product.price), gross })
        subtotal += gross
      }
    }
    bounded(subtotal)
    if (discount > subtotal) fail(400, 'El descuento supera el subtotal.')
    const total = subtotal - discount
    const plan = await paymentPlan(tx, input.payments, total, false)
    let grossSoFar = 0n
    const items = lines.map(line => {
      const before = subtotal ? discount * grossSoFar / subtotal : 0n
      grossSoFar += line.gross
      const allocation = subtotal ? discount * grossSoFar / subtotal - before : 0n
      const { gross, ...fields } = line
      return { ...fields, lineTotal: amount(gross - allocation) }
    })
    const sale = await tx.posSale.create({ data: { orderId: input.orderId ?? null, userId: user.id, customerName, customerDocument,
      subtotal: amount(subtotal), discount: amount(discount), total: amount(total), discountReason: discount ? input.discountReason : null,
      approvedById: discount ? user.id : null, items: { create: items }, payments: { create: plan } }, include: saleInclude })
    return input.mode === 'CONFIRM' ? confirm(tx, user, sale, input) : sale
  })
}
export function confirmSale(db, user, id, input) {
  return posOperation(db, user, `CONFIRM_SALE:${id}`, input, async tx => confirm(tx, user, await loadAndLockSale(tx, id), input))
}
export function cancelPendingSale(db, user, id, input) {
  return posOperation(db, user, `CANCEL_PENDING:${id}`, input, async tx => {
    const sale = await loadAndLockSale(tx, id)
    if (sale.status !== 'PENDING') fail(409, 'Una venta confirmada se corrige con devolución o anulación.')
    if (user.role !== 'ADMIN' && sale.userId !== user.id) fail(403, 'Esta venta pertenece a otra persona.')
    return tx.posSale.update({ where: { id }, data: { status: 'CANCELLED', cancellationReason: input.reason }, include: saleInclude })
  })
}

export function refundSale(db, user, id, input) {
  admin(user)
  return posOperation(db, user, `REFUND:${id}`, input, async tx => {
    const sale = await loadAndLockSale(tx, id)
    if (sale.status !== 'CONFIRMED') fail(409, 'La venta no admite más devoluciones.')
    const session = await lockCash(tx, input.sessionId, user)
    if (!input.verified) fail(400, 'Confirma que el reembolso fue realizado.')
    if (!(await paymentConfiguration(tx)).methods.some(method => method.key === input.method)) fail(409, 'Método de devolución no habilitado.')
    if (input.method !== cashMethod && !input.reference?.trim()) fail(400, 'Registra la referencia del reembolso digital.')
    const seen = new Set(), items = []
    let total = 0n
    for (const item of input.items) {
      const line = sale.items.find(row => row.id === item.saleItemId)
      if (!line || seen.has(line.id)) fail(400, 'Línea de devolución inválida o repetida.')
      seen.add(line.id)
      const previous = line.returns.reduce((sum, row) => sum + row.quantity, 0)
      if (previous + item.quantity > line.quantity) fail(409, 'No puedes devolver más unidades de las vendidas.')
      const value = returnCents(String(line.lineTotal), line.quantity, previous, item.quantity)
      total += value
      items.push({ saleItemId: line.id, quantity: item.quantity, restock: item.restock, amount: amount(value) })
    }
    if (input.kind === 'VOID' && sale.items.some(line => {
      const returned = line.returns.reduce((sum, row) => sum + row.quantity, 0)
      return (items.find(row => row.saleItemId === line.id)?.quantity ?? 0) + returned !== line.quantity
    })) fail(400, 'Para anular debes devolver todas las unidades restantes.')
    if (money(input.expectedAmount) !== total) fail(409, 'El importe de devolución cambió. Recarga la venta antes de reembolsar.')
    const refund = await tx.posRefund.create({ data: { saleId: id, userId: user.id, sessionId: session.id, kind: input.kind, method: input.method, reference: input.reference || null, reason: input.reason, amount: amount(total), items: { create: items } } })
    if (input.method === cashMethod && total) await cashEntry(tx, session, user, -total, 'REFUND', input.reason, `pos-refund:${refund.id}`, sale.id)
    for (const item of [...items].sort((a, b) => sale.items.find(line => line.id === a.saleItemId).productId.localeCompare(sale.items.find(line => line.id === b.saleItemId).productId))) {
      const line = sale.items.find(row => row.id === item.saleItemId)
      await recordConfirmedMovement(tx, { productId: line.productId, type: 'POS_RETURN', direction: 'IN', quantity: item.quantity,
        reason: input.reason, reference: `venta:${sale.id};devolucion:${refund.id}`, createdById: user.id, sourceKey: `pos-return:${refund.id}:${line.id}` })
      if (!item.restock) await recordConfirmedMovement(tx, { productId: line.productId, type: 'DAMAGE', direction: 'OUT', quantity: item.quantity,
        reason: `Devolución no vendible: ${input.reason}`, reference: refund.id, createdById: user.id, sourceKey: `pos-return-damage:${refund.id}:${line.id}` })
    }
    const complete = sale.items.every(line => line.returns.reduce((sum, row) => sum + row.quantity, 0) + (items.find(row => row.saleItemId === line.id)?.quantity ?? 0) === line.quantity)
    if (complete) {
      await tx.posSale.update({ where: { id }, data: { status: input.kind === 'VOID' ? 'VOIDED' : 'RETURNED' } })
      if (sale.orderId) {
        const order = await tx.order.findUnique({ where: { id: sale.orderId } })
        if (['PENDING', 'CONFIRMED', 'PAID'].includes(order.status)) await tx.order.update({ where: { id: order.id }, data: {
          status: 'CANCELLED', statusHistory: { create: { status: 'CANCELLED', note: `Devolución íntegra en POS ${sale.id}; stock y reembolso registrados en ${refund.id}. Sin segunda reposición.` } },
        } })
      }
    }
    return tx.posSale.findUnique({ where: { id }, include: saleInclude })
  })
}
