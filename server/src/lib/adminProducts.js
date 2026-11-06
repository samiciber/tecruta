import { serializeProduct } from './serializers.js'
import { changeStockFromProductEditor, InventoryError, recordConfirmedMovement } from './inventoryService.js'
import { ensureSkuAvailable } from './productIdentity.js'
import { slugify } from './slug.js'

const include = { category: true, images: true, brandRef: true }
const bad = message => Object.assign(new Error(message), { status: 400 })
const missing = () => Object.assign(new Error('Producto no encontrado.'), { status: 404 })
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

async function resolveBrand(tx, input, existing) {
  const hasId = owns(input, 'brandId'), hasName = owns(input, 'brand')
  if (hasId && input.brandId === null) {
    if (input.brand) throw bad('Para quitar la marca, deja también su nombre vacío.')
    return { brandId: null, brand: null }
  }
  if (!hasId && hasName && input.brand === null) return { brandId: null, brand: null }
  let brand
  if (hasId) {
    brand = await tx.brand.findUnique({ where: { id: input.brandId } })
    if (!brand) throw bad('La marca no existe. Selecciona una marca creada en Admin → Marcas.')
    if (hasName && input.brand?.toLowerCase() !== brand.name.toLowerCase()) throw bad('El nombre y el ID de marca no coinciden.')
  } else if (hasName && input.brand) {
    const matches = await tx.brand.findMany({ where: { name: { equals: input.brand, mode: 'insensitive' } }, take: 2 })
    if (matches.length !== 1) throw bad(matches.length ? 'Hay varias marcas con ese nombre. Envía el ID de marca.' : 'La marca no existe. Créala primero en Admin → Marcas.')
    brand = matches[0]
  } else if (existing?.brandId) {
    brand = await tx.brand.findUnique({ where: { id: existing.brandId } })
  } else if (existing?.brand) {
    // Reconcile legacy text when editing, without creating or guessing brands.
    return resolveBrand(tx, { brand: existing.brand }, null)
  }
  if (!brand) return { brandId: null, brand: null }
  // Keep the selected brand stable while writing both columns, including a
  // concurrent brand rename or delete. Re-read after acquiring the lock.
  await tx.$queryRaw`SELECT id FROM brands WHERE id = ${brand.id} FOR SHARE`
  brand = await tx.brand.findUnique({ where: { id: brand.id } })
  if (!brand) throw bad('La marca ya no existe. Selecciona otra marca.')
  if (hasId && hasName && input.brand?.toLowerCase() !== brand.name.toLowerCase()) throw bad('El nombre y el ID de marca no coinciden.')
  return { brandId: brand.id, brand: brand.name }
}
async function categoryData(tx, category) {
  if (category === undefined) return {}
  const row = await tx.category.findUnique({ where: { slug: category } })
  if (!row) throw bad('La categoría no existe.')
  return { categoryId: row.id }
}

// Genera el slug si el cliente no envió uno: deriva del nombre y, si ya
// existe, agrega -2, -3… hasta encontrar uno libre. Un slug enviado por el
// usuario se respeta tal cual (el esquema ya validó su formato).
async function resolveProductSlug(tx, requested, name) {
  const provided = slugify(requested)
  if (provided) return provided
  const base = (slugify(name) || 'producto').slice(0, 150)
  let candidate = base
  for (let attempt = 2; attempt <= 1000; attempt++) {
    const existing = await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing) return candidate
    candidate = `${base}-${attempt}`
  }
  throw bad('No se pudo generar un slug único. Cambia el nombre del producto.')
}

export async function createAdminProduct(db, input, userId = null) {
  return db.$transaction(async tx => {
    const { category, images, brand, brandId, stock: targetStock = 0, expectedStock, stockReason, sku, slug, ...fields } = input
    if (targetStock > 0 && !stockReason?.trim()) throw new InventoryError(400, 'Indica el motivo del saldo inicial.')
    const normalizedSku = await ensureSkuAvailable(tx, sku)
    const resolvedSlug = await resolveProductSlug(tx, slug, fields.name)
    let row = await tx.product.create({ data: {
      tags: [], ...fields, slug: resolvedSlug, sku: normalizedSku ?? undefined, stock: 0,
      ...await categoryData(tx, category), ...await resolveBrand(tx, input, null),
      image: fields.image ?? images?.[0] ?? null,
      images: images?.length ? { create: images.map((url, position) => ({ url, position })) } : undefined,
    }, include })
    if (!normalizedSku) {
      row = await tx.product.update({
        where: { id: row.id },
        data: { sku: await ensureSkuAvailable(tx, `TR-${row.id}`) },
        include,
      })
    }
    await recordConfirmedMovement(tx, {
      productId: row.id,
      type: 'INITIAL_BALANCE',
      direction: 'IN',
      quantity: targetStock,
      reason: stockReason?.trim() || 'Saldo inicial al crear el producto.',
      reference: 'Creación de producto',
      sourceKey: `product-initial:${row.id}`,
      createdById: userId,
      confirmedById: userId,
    })
    return serializeProduct(await tx.product.findUnique({ where: { id: row.id }, include }))
  })
}
export async function updateAdminProduct(db, id, input, userId = null) {
  return db.$transaction(async tx => {
    let existing = await tx.product.findUnique({ where: { id } })
    if (!existing) throw missing()
    // Bloquear la marca ANTES del producto: el trigger de búsqueda
    // (store_refresh_related_search) actualiza los productos de una marca al
    // renombrarla; si el producto se bloqueara primero, se formaría un
    // deadlock (40P01) entre edición de producto y renombre de marca.
    const brandData = await resolveBrand(tx, input, existing)
    // Serializes competing product edits, including brand changes/image replacement.
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`
    existing = await tx.product.findUnique({ where: { id } })
    if (!existing) throw missing()
    const { category, images, brand, brandId, stock: targetStock, expectedStock, stockReason, sku, ...fields } = input
    if (targetStock !== undefined && targetStock !== existing.stock) {
      if (!Number.isInteger(expectedStock)) throw bad('Actualiza el producto antes de modificar el stock; falta el saldo esperado.')
      if (expectedStock !== existing.stock) throw new InventoryError(409, 'El stock cambió desde que abriste el editor. Recarga antes de ajustar.')
    }
    if (Object.hasOwn(input, 'sku')) {
      fields.sku = await ensureSkuAvailable(tx, sku, id)
      if (!fields.sku) throw bad('El SKU es obligatorio.')
    }
    await tx.product.update({ where: { id }, data: {
      ...fields, ...await categoryData(tx, category), ...brandData,
    } })
    if (targetStock !== undefined) {
      await changeStockFromProductEditor(tx, {
        productId: id,
        targetStock,
        reason: stockReason,
        userId,
        source: 'Editor de producto',
      })
    }
    if (images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } })
      if (images.length) await tx.productImage.createMany({ data: images.map((url, position) => ({ url, position, productId: id })) })
    }
    return serializeProduct(await tx.product.findUnique({ where: { id }, include }))
  })
}
