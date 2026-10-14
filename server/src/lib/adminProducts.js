import { serializeProduct } from './serializers.js'

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

export async function createAdminProduct(db, input) {
  return db.$transaction(async tx => {
    const { category, images, brand, brandId, ...fields } = input
    const row = await tx.product.create({ data: {
      tags: [], ...fields, ...await categoryData(tx, category), ...await resolveBrand(tx, input, null),
      image: fields.image ?? images?.[0] ?? null,
      images: images?.length ? { create: images.map((url, position) => ({ url, position })) } : undefined,
    }, include })
    return serializeProduct(row)
  })
}
export async function updateAdminProduct(db, id, input) {
  return db.$transaction(async tx => {
    // Serializes competing product edits, including brand changes/image replacement.
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`
    const existing = await tx.product.findUnique({ where: { id } })
    if (!existing) throw missing()
    const { category, images, brand, brandId, ...fields } = input
    await tx.product.update({ where: { id }, data: {
      ...fields, ...await categoryData(tx, category), ...await resolveBrand(tx, input, existing),
    } })
    if (images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } })
      if (images.length) await tx.productImage.createMany({ data: images.map((url, position) => ({ url, position, productId: id })) })
    }
    return serializeProduct(await tx.product.findUnique({ where: { id }, include }))
  })
}
