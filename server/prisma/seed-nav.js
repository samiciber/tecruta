// Siembra la navegación de TecRuta desde src/data/navSeed.js (única fuente):
// categorías en árbol, marcas, menús, búsquedas populares y ajustes.
//
// Es IDEMPOTENTE y NO PISA ediciones del admin: cada sección solo se siembra
// si está vacía (o si el registro no existe). No toca productos salvo asignar
// la marca UGREEN a los que no tienen marca normalizada.
//
// Uso:  npm run seed:nav        (recomendado en una BD con datos reales)
//       npm run seed            (también lo ejecuta, pero además re-sincroniza
//                                el catálogo estático: úsalo solo en BD nueva)

import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { slugify } from '../src/lib/slug.js'
import {
  LEGACY_CATEGORY_SLUGS,
  categoryTree,
  featuredBrandNames,
  allBrandNames,
  navMenus,
  popularSearchSeed,
  storeSeed,
  siteSettingsSeed,
} from '../../src/data/navSeed.js'

// Calcula el slug definitivo de cada nodo del árbol sin colisiones: usa el
// slug explícito o el derivado del nombre; si ya está tomado (por una
// categoría heredada o por otra rama), lo prefija con el slug del padre.
// Es determinista: la misma entrada produce los mismos slugs.
export function planCategorySlugs(tree, taken = new Set()) {
  const used = new Set(taken)
  const plan = []
  const visit = (node, parentSlug, parentKey, position) => {
    let slug = node.slug || slugify(node.name)
    if (used.has(slug) && parentSlug) slug = `${parentSlug}-${slug}`
    let n = 2
    const base = slug
    while (used.has(slug)) slug = `${base}-${n++}`
    used.add(slug)
    const key = `${parentKey ?? ''}/${slug}`
    plan.push({ key, parentKey, slug, name: node.name, position, sourceRef: node.sourceRef ?? null })
    node.children.forEach((child, i) => visit(child, slug, key, i))
  }
  tree.forEach((node, i) => visit(node, null, null, i))
  return plan
}

async function seedLegacyCategories(prisma) {
  const res = await prisma.category.updateMany({
    where: { slug: { in: LEGACY_CATEGORY_SLUGS } },
    data: { legacy: true },
  })
  console.log(`→ Categorías heredadas marcadas: ${res.count}`)
}

async function seedCategoryTree(prisma) {
  const existing = await prisma.category.count({ where: { legacy: false } })
  if (existing > 0) {
    console.log(`→ Árbol de categorías: ya existe (${existing} nodos), se omite.`)
    return
  }
  const taken = new Set((await prisma.category.findMany({ select: { slug: true } })).map((c) => c.slug))
  const plan = planCategorySlugs(categoryTree, taken)
  console.log(`→ Sembrando árbol de categorías (${plan.length} nodos)...`)
  const idByKey = new Map()
  for (const p of plan) {
    const row = await prisma.category.create({
      data: {
        slug: p.slug,
        name: p.name,
        parentId: p.parentKey ? idByKey.get(p.parentKey) : null,
        position: p.position,
        visible: true,
        legacy: false,
        sourceRef: p.sourceRef,
      },
    })
    idByKey.set(p.key, row.id)
  }
}

async function seedBrands(prisma) {
  const count = await prisma.brand.count()
  if (count === 0) {
    const names = [...new Set(allBrandNames)]
    console.log(`→ Sembrando ${names.length} marcas (${featuredBrandNames.length} destacadas)...`)
    const used = new Set()
    for (const name of names) {
      let slug = slugify(name)
      while (used.has(slug)) slug += '-2'
      used.add(slug)
      const fi = featuredBrandNames.indexOf(name)
      await prisma.brand.create({
        data: { name, slug, featured: fi >= 0, featuredPosition: fi >= 0 ? fi : 0, visible: true },
      })
    }
  } else {
    console.log(`→ Marcas: ya existen (${count}), se omite.`)
  }

  // Todos los productos hoy son UGREEN: enlaza solo los que aún no tienen
  // marca normalizada y cuyo texto `brand` coincide.
  const ugreen = await prisma.brand.findUnique({ where: { slug: 'ugreen' } })
  if (ugreen) {
    const res = await prisma.product.updateMany({
      where: { brandId: null, brand: { equals: 'ugreen', mode: 'insensitive' } },
      data: { brandId: ugreen.id },
    })
    const left = await prisma.product.count({ where: { brandId: null } })
    console.log(`→ Productos asociados a UGREEN: ${res.count}. Sin marca normalizada: ${left}.`)
  }
}

async function seedNavItems(prisma) {
  for (const [menuKey, items] of Object.entries(navMenus)) {
    const count = await prisma.navItem.count({ where: { menuKey } })
    if (count > 0) {
      console.log(`→ Menú "${menuKey}": ya tiene ítems (${count}), se omite.`)
      continue
    }
    console.log(`→ Sembrando menú "${menuKey}" (${items.length} ítems)...`)
    for (const [i, item] of items.entries()) {
      const parent = await prisma.navItem.create({
        data: { menuKey, type: item.type, label: item.label, href: item.href ?? null, position: i },
      })
      for (const [j, child] of (item.children || []).entries()) {
        await prisma.navItem.create({
          data: { menuKey, parentId: parent.id, type: child.type, label: child.label, href: child.href ?? null, position: j },
        })
      }
    }
  }
}

async function seedPopularSearches(prisma) {
  if ((await prisma.popularSearch.count()) > 0) return console.log('→ Búsquedas populares: ya existen, se omite.')
  console.log(`→ Sembrando ${popularSearchSeed.length} búsquedas populares...`)
  await prisma.popularSearch.createMany({ data: popularSearchSeed.map((text, position) => ({ text, position })) })
}

async function seedStores(prisma) {
  if (storeSeed.length === 0 || (await prisma.store.count()) > 0) return
  await prisma.store.createMany({ data: storeSeed })
}

async function seedSiteSettings(prisma) {
  for (const [key, value] of Object.entries(siteSettingsSeed)) {
    const found = await prisma.siteSetting.findUnique({ where: { key } })
    if (!found) await prisma.siteSetting.create({ data: { key, value } })
  }
  console.log('→ Ajustes del sitio verificados.')
}

export async function seedNav(prisma) {
  await seedLegacyCategories(prisma)
  await seedCategoryTree(prisma)
  await seedBrands(prisma)
  await seedNavItems(prisma)
  await seedPopularSearches(prisma)
  await seedStores(prisma)
  await seedSiteSettings(prisma)
  console.log('✔ Seed de navegación completo.')
}

// Ejecución directa: `npm run seed:nav`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient()
  seedNav(prisma)
    .catch((err) => {
      console.error('✖ Error en el seed de navegación:', err)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}