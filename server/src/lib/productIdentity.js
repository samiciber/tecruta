import { InventoryError } from './inventoryService.js'

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,39}$/

export function normalizeSku(value) {
  if (value === null || value === undefined || value === '') return null
  const sku = value.trim().toUpperCase()
  if (!SKU_PATTERN.test(sku)) {
    throw new InventoryError(400, 'El SKU admite hasta 40 letras, números, puntos, guiones y guiones bajos.')
  }
  return sku
}

export function normalizeBarcode(value) {
  const code = typeof value === 'string' ? value.trim() : ''
  if (!code || code.length > 128 || /[\u0000-\u001f\u007f]/.test(code)) {
    throw new InventoryError(400, 'El código debe ser texto de 1 a 128 caracteres.')
  }
  return { code, normalizedCode: code.toUpperCase() }
}

async function lockIdentifier(tx, normalized) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`tecruta:product-identifier:${normalized}`}, 0))`
}

export async function ensureSkuAvailable(tx, value, productId = null) {
  const sku = normalizeSku(value)
  if (!sku) return null
  await lockIdentifier(tx, sku)
  const [product, barcode] = await Promise.all([
    tx.product.findUnique({ where: { sku }, select: { id: true } }),
    tx.productBarcode.findUnique({ where: { normalizedCode: sku }, select: { productId: true } }),
  ])
  if ((product && product.id !== productId) || barcode) {
    throw new InventoryError(409, 'El SKU ya está asociado a un producto o código de barras.')
  }
  return sku
}

export async function ensureBarcodeAvailable(tx, value) {
  const barcode = normalizeBarcode(value)
  await lockIdentifier(tx, barcode.normalizedCode)
  const [product, existing] = await Promise.all([
    tx.product.findUnique({ where: { sku: barcode.normalizedCode }, select: { id: true } }),
    tx.productBarcode.findUnique({ where: { normalizedCode: barcode.normalizedCode }, select: { id: true } }),
  ])
  if (product || existing) throw new InventoryError(409, 'El código ya está asignado a un SKU o a otro producto.')
  return barcode
}
