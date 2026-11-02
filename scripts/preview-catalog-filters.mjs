import { createPanelPreview } from './lib/panel-preview-runtime.mjs'
const rt = await createPanelPreview({ storePort: 5223, panelPort: 5224 })
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await rt.close()
  process.exit()
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
try {
  const brand = await rt.db.brand.create({
    data: { slug: 'qa-ugreen', name: 'UGREEN (QA sintética)' },
  })
  const other = await rt.db.brand.create({ data: { slug: 'qa-otra', name: 'Otra marca QA' } })
  const parent = await rt.db.category.create({
    data: { slug: 'qa-accesorios', name: 'Accesorios QA', visible: true },
  })
  for (const [i, slug, name, label, value] of [
    [0, 'qa-cables', 'Cables QA', 'Conector', 'USB-C'],
    [1, 'qa-cargadores', 'Cargadores QA', 'Potencia', '30 W'],
    [2, 'qa-baterias', 'Baterías QA', 'Capacidad', '10000 mAh'],
  ]) {
    const category = await rt.db.category.create({
      data: { slug, name, parentId: parent.id, visible: true },
    })
    await rt.db.product.update({
      where: { id: rt.products[i].id },
      data: {
        name: name + ' sintético',
        categoryId: category.id,
        brand: brand.name,
        brandId: brand.id,
        specifications: [{ label, value }],
      },
    })
    await rt.product(3, {
      name: name + ' alternativa sintética',
      categoryId: category.id,
      brand: brand.name,
      brandId: brand.id,
      price: '89.90',
      specifications: [
        {
          label,
          value: label === 'Potencia' ? '65 W' : label === 'Capacidad' ? '20000 mAh' : 'USB-A',
        },
      ],
      image: `${rt.shop}/revision-local/producto.svg`,
    })
  }
  const laptop = await rt.db.category.create({
    data: { slug: 'qa-laptops', name: 'Laptops QA', visible: true },
  })
  await rt.product(2, {
    name: 'Laptop sintética QA',
    categoryId: laptop.id,
    brand: other.name,
    brandId: other.id,
    price: '2000',
    specifications: [{ label: 'RAM', value: '16 GB' }],
    image: `${rt.shop}/revision-local/producto.svg`,
  })
  console.log(`REVISIÓN SINTÉTICA: ${rt.shop}/marca/qa-ugreen`)
  console.log(`Catálogo: ${rt.shop}/catalogo | Categoría: ${rt.shop}/categoria/qa-accesorios`)
  console.log(
    'PostgreSQL local desechable, sin producción ni correos reales. Ctrl+C limpia el entorno QA.',
  )
} catch (error) {
  await rt.close()
  throw error
}
