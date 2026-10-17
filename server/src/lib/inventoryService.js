import { Prisma } from '@prisma/client'

const DIRECTIONS = {
  INITIAL_BALANCE: 'IN',
  PURCHASE: 'IN',
  CUSTOMER_RETURN: 'IN',
  POSITIVE_ADJUSTMENT: 'IN',
  LOSS: 'OUT',
  DAMAGE: 'OUT',
  SUPPLIER_RETURN: 'OUT',
  NEGATIVE_ADJUSTMENT: 'OUT',
  WEB_ORDER: 'OUT',
  WEB_CANCELLATION: 'IN',
  POS_SALE: 'OUT',
  POS_RETURN: 'IN',
}

export class InventoryError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validateQuantity(type, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || (quantity === 0 && type !== 'INITIAL_BALANCE')) {
    throw new InventoryError(400, 'La cantidad debe ser un entero positivo.')
  }
}

async function updateProductStock(tx, { productId, direction, quantity }) {
  await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`
  const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, stock: true } })
  if (!product) throw new InventoryError(404, 'Producto no encontrado.')

  const nextStock = direction === 'IN' ? product.stock + quantity : product.stock - quantity
  if (!Number.isSafeInteger(nextStock) || nextStock < 0 || nextStock > 2147483647) {
    throw new InventoryError(409, nextStock < 0 ? 'El movimiento dejaría el stock negativo.' : 'El stock supera el máximo permitido.')
  }

  if (nextStock !== product.stock) {
    const changed = await tx.product.updateMany({
      where: direction === 'OUT'
        ? { id: productId, stock: { gte: quantity } }
        : { id: productId, stock: product.stock },
      data: { stock: nextStock },
    })
    if (changed.count !== 1) throw new InventoryError(409, 'El stock cambió simultáneamente. Actualiza e inténtalo de nuevo.')
  }
  return nextStock
}

function serializableMovement(movement) {
  return { ...movement, unitCost: movement.unitCost === null ? null : Number(movement.unitCost) }
}

export async function recordConfirmedMovement(tx, input) {
  validateQuantity(input.type, input.quantity)
  const expectedDirection = input.type === 'REVERSAL' ? input.direction : DIRECTIONS[input.type]
  if (!expectedDirection || input.direction !== expectedDirection) {
    throw new InventoryError(400, 'El tipo y la dirección del movimiento no coinciden.')
  }

  if (input.sourceKey) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory:${input.sourceKey}`}, 0))`
    const previous = await tx.inventoryMovement.findUnique({ where: { sourceKey: input.sourceKey } })
    if (previous) {
      const sameOperation = previous.productId === input.productId
        && previous.type === input.type
        && previous.direction === input.direction
        && previous.quantity === input.quantity
      if (!sameOperation) throw new InventoryError(409, 'La clave de idempotencia ya pertenece a otro movimiento.')
      return { movement: serializableMovement(previous), replayed: true }
    }
  }

  const balanceAfter = await updateProductStock(tx, input)
  const now = new Date()
  const movement = await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      direction: input.direction,
      status: 'CONFIRMED',
      quantity: input.quantity,
      reason: input.reason,
      reference: input.reference ?? null,
      supplier: input.supplier ?? null,
      unitCost: input.unitCost === null || input.unitCost === undefined ? null : new Prisma.Decimal(input.unitCost),
      occurredAt: input.occurredAt ?? now,
      confirmedAt: now,
      createdById: input.createdById ?? null,
      confirmedById: input.confirmedById ?? input.createdById ?? null,
      sourceKey: input.sourceKey ?? null,
      reversalOfId: input.reversalOfId ?? null,
      balanceAfter,
    },
  })
  return { movement: serializableMovement(movement), replayed: false }
}

export async function createDraftMovement(db, input) {
  validateQuantity(input.type, input.quantity)
  const expectedDirection = input.type === 'REVERSAL' ? input.direction : DIRECTIONS[input.type]
  if (!expectedDirection || input.direction !== expectedDirection) {
    throw new InventoryError(400, 'El tipo y la dirección del movimiento no coinciden.')
  }
  return db.$transaction(async tx => {
    const sourceKey = `inventory-draft:${input.requestId}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sourceKey}, 0))`
    const existing = await tx.inventoryMovement.findUnique({ where: { sourceKey } })
    if (existing) {
      if (existing.productId !== input.productId || existing.type !== input.type || existing.quantity !== input.quantity
        || existing.reason !== input.reason || existing.createdById !== input.createdById
        || (existing.reference ?? null) !== (input.reference ?? null)
        || (existing.supplier ?? null) !== (input.supplier ?? null)
        || (existing.unitCost === null ? null : Number(existing.unitCost)) !== (input.unitCost ?? null)
        || (input.occurredAt && existing.occurredAt.getTime() !== input.occurredAt.getTime())) {
        throw new InventoryError(409, 'Este intento ya pertenece a otro borrador. Actualiza antes de continuar.')
      }
      return serializableMovement(existing)
    }
    const movement = await tx.inventoryMovement.create({
      data: {
        sourceKey,
        productId: input.productId,
        type: input.type,
        direction: input.direction,
        status: 'DRAFT',
        quantity: input.quantity,
        reason: input.reason,
        reference: input.reference ?? null,
        supplier: input.supplier ?? null,
        unitCost: input.unitCost === null || input.unitCost === undefined ? null : new Prisma.Decimal(input.unitCost),
        occurredAt: input.occurredAt ?? new Date(),
        createdById: input.createdById ?? null,
      },
    })
    return serializableMovement(movement)
  })
}

export async function confirmDraftMovement(db, movementId, userId) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM inventory_movements WHERE id = ${movementId} FOR UPDATE`
    const draft = await tx.inventoryMovement.findUnique({ where: { id: movementId } })
    if (!draft) throw new InventoryError(404, 'Borrador no encontrado.')
    if (draft.status === 'CONFIRMED') return serializableMovement(draft)
    const balanceAfter = await updateProductStock(tx, draft)
    const confirmed = await tx.inventoryMovement.update({
      where: { id: draft.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: userId, balanceAfter },
    })
    return serializableMovement(confirmed)
  })
}

export async function reverseMovement(db, movementId, userId, reason) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM inventory_movements WHERE id = ${movementId} FOR UPDATE`
    const original = await tx.inventoryMovement.findUnique({ where: { id: movementId } })
    if (!original) throw new InventoryError(404, 'Movimiento no encontrado.')
    if (original.status !== 'CONFIRMED') throw new InventoryError(409, 'Solo se pueden revertir movimientos confirmados.')
    if (original.type === 'INITIAL_BALANCE' || original.type === 'REVERSAL') {
      throw new InventoryError(409, 'El saldo inicial y las reversiones no se revierten.')
    }
    if (['WEB_ORDER', 'WEB_CANCELLATION', 'POS_SALE', 'POS_RETURN'].includes(original.type) || original.sourceKey?.startsWith('pos-')) {
      throw new InventoryError(409, 'Los movimientos web se corrigen desde el pedido para conservar su estado y stock.')
    }
    const existing = await tx.inventoryMovement.findUnique({ where: { reversalOfId: movementId } })
    if (existing) throw new InventoryError(409, 'Este movimiento ya tiene una reversión.')
    const direction = original.direction === 'IN' ? 'OUT' : 'IN'
    const result = await recordConfirmedMovement(tx, {
      productId: original.productId,
      type: 'REVERSAL',
      direction,
      quantity: original.quantity,
      reason,
      reference: original.reference ?? `Movimiento ${original.id}`,
      createdById: userId,
      confirmedById: userId,
      sourceKey: `inventory-reversal:${original.id}`,
      reversalOfId: original.id,
    })
    return result.movement
  })
}

export async function changeStockFromProductEditor(tx, { productId, targetStock, reason, userId, source }) {
  await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`
  const product = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } })
  if (!product) throw new InventoryError(404, 'Producto no encontrado.')
  const difference = targetStock - product.stock
  if (difference === 0) return null
  if (!reason?.trim()) throw new InventoryError(400, 'Indica el motivo del cambio de stock.')
  const direction = difference > 0 ? 'IN' : 'OUT'
  const type = direction === 'IN' ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT'
  return recordConfirmedMovement(tx, {
    productId,
    type,
    direction,
    quantity: Math.abs(difference),
    reason: reason.trim(),
    reference: source,
    createdById: userId,
    confirmedById: userId,
  })
}

export function movementDirection(type) {
  return DIRECTIONS[type]
}
