import fs from 'fs'
import path from 'path'
import { products } from './src/data/products.js'
import { categories } from './src/data/categories.js'

const OUT_DIR = path.join(process.cwd(), 'src', 'data', 'products')
fs.mkdirSync(OUT_DIR, { recursive: true })

const porCategoria = {}
for (const cat of categories) porCategoria[cat.slug] = []
for (const p of products) {
  if (!porCategoria[p.category]) porCategoria[p.category] = []
  porCategoria[p.category].push(p)
}

for (const [slug, lista] of Object.entries(porCategoria)) {
  const contenido = `// Generado automáticamente por dividir-productos.js — no lo edites a mano.
// Para actualizar: edita src/data/products.js y vuelve a ejecutar el script.
export const productos = ${JSON.stringify(lista, null, 2)}
`
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.js`), contenido, 'utf8')
  console.log(`${slug}.js -> ${lista.length} productos`)
}

const indice = products.map((p) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  category: p.category,
  price: p.price,
  compareAtPrice: p.compareAtPrice,
  stock: p.stock,
  featured: p.featured,
  bestSeller: p.bestSeller || false,
  image: p.image,
  tags: p.tags,
}))
fs.writeFileSync(
  path.join(process.cwd(), 'src', 'data', 'productIndex.js'),
  `// Generado automáticamente. Índice liviano usado por el catálogo, inicio y carrito.
export const productIndex = ${JSON.stringify(indice, null, 2)}
`,
  'utf8',
)
console.log(`productIndex.js -> ${indice.length} productos`)