// Migra los datos actuales de src/data/categories.js y src/data/products.js
// (arrays estáticos del frontend) hacia la base de datos real.
//
// Se importan directamente desde el frontend para no duplicar información
// a mano — esto es un paso de UNA SOLA VEZ para arrancar con los mismos
// productos que ya tienes hoy. De ahí en adelante, el catálogo se
// administra en la base de datos, no en products.js.
//
// Uso:
//   npm run seed

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { categories } from '../../src/data/categories.js'
import { products } from '../../src/data/products.js'
import { paymentConfig } from '../../src/config/paymentConfig.js'

const prisma = new PrismaClient()

async function seedCategories() {
  console.log(`→ Sembrando ${categories.length} categorías...`)
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon },
      create: { slug: c.slug, name: c.name, description: c.description, icon: c.icon },
    })
  }
}

async function seedProducts() {
  console.log(`→ Sembrando ${products.length} productos...`)
  for (const p of products) {
    const category = await prisma.category.findUnique({ where: { slug: p.category } })
    if (!category) {
      console.warn(`  ⚠️  Producto "${p.slug}" referencia una categoría inexistente ("${p.category}"), se omite.`)
      continue
    }

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        brand: p.brand ?? null,
        description: p.description ?? null,
        shortDescription: p.shortDescription ?? null,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        stock: p.stock ?? 0,
        featured: Boolean(p.featured),
        bestSeller: Boolean(p.bestSeller),
        image: p.image ?? null,
        tags: p.tags ?? [],
        specifications: p.specifications ?? null,
        categoryId: category.id,
      },
      create: {
        slug: p.slug,
        name: p.name,
        brand: p.brand ?? null,
        description: p.description ?? null,
        shortDescription: p.shortDescription ?? null,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        stock: p.stock ?? 0,
        featured: Boolean(p.featured),
        bestSeller: Boolean(p.bestSeller),
        image: p.image ?? null,
        tags: p.tags ?? [],
        specifications: p.specifications ?? null,
        categoryId: category.id,
      },
    })

    // Reemplaza las imágenes del producto (simple: borra e inserta de nuevo).
    await prisma.productImage.deleteMany({ where: { productId: product.id } })
    const images = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : []
    if (images.length > 0) {
      await prisma.productImage.createMany({
        data: images.map((url, position) => ({ url, position, productId: product.id })),
      })
    }
  }
}

async function seedPaymentMethods() {
  console.log(`→ Sembrando ${Object.keys(paymentConfig).length} métodos de pago...`)
  for (const [key, cfg] of Object.entries(paymentConfig)) {
    const { label, enabled, ...config } = cfg
    await prisma.paymentMethod.upsert({
      where: { key },
      update: { label, active: enabled ?? true, config },
      create: { key, label, active: enabled ?? true, config },
    })
  }
}

async function main() {
  await seedCategories()
  await seedProducts()
  await seedPaymentMethods()
  console.log('✔ Seed completo.')
}

main()
  .catch((err) => {
    console.error('✖ Error en el seed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })