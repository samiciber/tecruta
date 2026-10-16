// Manual local QA only. No database, .env, migrations or external assets.
import express from 'express'
import { createServer } from 'vite'
import { prisma } from '../src/lib/prisma.js'
import { contentRouter } from '../src/routes/content.routes.js'
import { adminContentRouter } from '../src/routes/adminContent.routes.js'
import { homeLayoutSchema } from '../src/lib/homeSchemas.js'
import { homeBannersSchema } from '../src/lib/navSchemas.js'
import { serializeProduct } from '../src/lib/serializers.js'
import { signToken } from '../src/lib/token.js'

process.env.JWT_SECRET = 'synthetic-home-5b-session-only'
const origin = 'http://127.0.0.1:4406'
const asset = `${origin}/fixtures/scene.svg`
const user = { id: 'qa-home-admin', email: 'qa@example.test', nombre: 'QA', role: 'ADMIN', tokenVersion: 0 }
const categoryRows = ['Escritorio', 'Audio', 'Carga', 'Movilidad', 'Conexión', 'Organización'].map((name, i) => ({ id: `cat-${i}`, slug: `categoria-${i}`, name, image: `${origin}/fixtures/product-${i}.svg`, visible: true, legacy: false, parentId: null, position: i, _count: { products: 5 } }))
const brandRows = [
  { slug: 'marca-alfa', name: 'Marca Alfa · QA', logo: `${origin}/fixtures/logo.svg`, visible: true, featured: true, featuredPosition: 0 },
  { slug: 'marca-beta', name: 'Marca Beta · QA', logo: null, visible: true, featured: true, featuredPosition: 1 },
  { slug: 'marca-gamma', name: 'Marca Gamma · QA', logo: `${origin}/fixtures/logo.svg`, visible: true, featured: false, featuredPosition: 0 },
  { slug: 'marca-oculta', name: 'Marca oculta', visible: false, featured: true, featuredPosition: 0 },
]
const productRows = Array.from({ length: 8 }, (_, i) => ({
  id: `qa-p-${i}`, slug: `qa-p-${i}`, name: ['Auriculares de prueba', 'Cargador de prueba', 'Teclado de prueba', 'Soporte de prueba'][i % 4],
  brand: 'Marca Alfa · QA', category: { slug: 'categoria-0' }, brandRef: null, images: [],
  image: `${origin}/fixtures/product-${i}.svg`, price: 79.9 + i * 20, compareAtPrice: i % 2 ? null : 119.9 + i * 20,
  stock: i === 1 ? 0 : i === 2 ? 3 : 15, featured: true, bestSeller: true,
}))
const banner = (id, title) => ({ id, title, eyebrow: 'Colección de prueba', description: 'Accesorios para organizar tu tecnología y acompañar tus actividades. Contenido sintético para revisión local.',
  imageDesktop: asset, active: true, placement: 'inline', slot: 'qa', position: 'middle-left', overlay: 35,
  buttons: [{ label: 'Explorar selección', href: '/catalogo', style: 'primary' }, { label: 'Conocer más', href: '/ayuda', style: 'secondary' }],
})
const link = (id, title) => ({ id, title, image: `${origin}/fixtures/product-${id.length % 5}.svg`, description: 'Accesorios y tecnología para este momento.', href: `/categoria/categoria-${id.length % 5}` })
const source = { id: 'featured', label: 'Selección de productos', kind: 'featured', href: '/catalogo' }
let layout = homeLayoutSchema.parse({ sections: [
  { id: 'split-cat', type: 'splitRow', title: 'Explora tu próxima ruta', ratio: '60/40', bannerId: 'editorial-1', categorySlugs: categoryRows.map(c => c.slug) },
  { id: 'tiles-four', type: 'editorialTiles', title: 'Tecnología para cada momento', columns: 4, items: ['Estudia a tu ritmo', 'Trabaja con comodidad', 'Lleva tu música', 'Mantente conectado'].map((title, i) => link(`tile-${i}`, title)) },
  { id: 'brands', type: 'brands', title: 'Comprar por marca', limit: 6 },
  { id: 'split-products', type: 'splitRow', title: 'Completa tu equipo', ratio: '50/50', reverse: true, bannerId: 'editorial-2', panelKind: 'products', source, limit: 4 },
  { id: 'use', type: 'useSelections', title: 'Encuentra tu espacio', tabs: ['Estudio', 'Trabajo', 'En movimiento'].map((label, i) => ({ id: `use-${i}`, label, image: `${origin}/fixtures/scene-${i}.svg`, imageAlt: `Ilustración sintética: ${label}`, links: ['Audio', 'Carga', 'Conexión', 'Organización'].map((title, j) => link(`access-${i}-${j}`, `${title} para ${label.toLowerCase()}`)) })) },
  { id: 'benefits', type: 'benefits', title: 'Información para acompañarte', items: [
    { id: 'info', icon: 'info', title: 'Conoce el producto', text: 'Consulta las características publicadas en cada ficha.' },
    { id: 'help', icon: 'headphones', title: 'Resuelve tus dudas', text: 'Encuentra los canales disponibles en nuestra sección de ayuda.' },
    { id: 'account', icon: 'package', title: 'Tu cuenta', text: 'Consulta tus pedidos al iniciar sesión.' },
    { id: 'details', icon: 'fileText', title: 'Información a mano', text: 'Revisa los detalles antes de elegir tus accesorios.' },
  ] },
  { id: 'support', type: 'supportLinks', title: 'Estamos para orientarte' },
  { id: 'legal', type: 'legalText', title: 'Información de esta selección', text: 'Contenido de prueba para validar la estructura del Home.\nLos nombres, imágenes y precios de esta revisión son sintéticos. Consulta las fichas para conocer las características de cada producto.' },
  { id: 'tiles-five', type: 'editorialTiles', title: 'Más formas de explorar', columns: 5, items: ['Audio', 'Escritorio', 'Movilidad', 'Carga', 'Conexión'].map((title, i) => link(`five-${i}`, title)) },
  { id: 'partial', type: 'splitRow', title: 'Panel sin banner', categorySlugs: ['categoria-0', 'categoria-1'] },
  { id: 'old-products', type: 'products', title: 'Carrusel 5a conservado', limit: 4, sources: [source], panel: { title: 'Panel de 5a', description: 'Conserva el contrato corregido.', label: 'Ver catálogo', href: '/catalogo' } },
  { id: 'empty-legal', type: 'legalText' },
  { id: 'disabled-brands', type: 'brands', active: false },
] })
const settings = {
  homeLayout: layout,
  homeBanners: homeBannersSchema.parse([banner('editorial-1', 'Un espacio para tus ideas'), banner('editorial-2', 'Pequeños accesorios, nuevas posibilidades')]),
  cartFooterLinks: [
    { label: 'Centro de ayuda', href: '/ayuda' }, { label: 'Consulta tus pedidos', href: '/mis-pedidos' },
    { label: 'Información disponible', href: '/proximamente' }, { label: 'Más información', href: '/proximamente' }, { label: 'Consulta nuestros canales', href: '/proximamente' },
  ],
}
prisma.siteSetting.findMany = async () => Object.entries(settings).map(([key, value]) => ({ key, value }))
prisma.siteSetting.upsert = async ({ update }) => { layout = update.value; settings.homeLayout = layout; return { value: layout } }
prisma.user.findUnique = async () => user
prisma.category.findMany = async ({ where = {} } = {}) => categoryRows.filter(row => !where.slug?.in || where.slug.in.includes(row.slug))
prisma.category.findUnique = async ({ where }) => categoryRows.find(row => row.slug === where.slug) || null
prisma.brand.findMany = async ({ where = {}, take } = {}) => brandRows.filter(row => !where.visible || row.visible).sort((a, b) => Number(b.featured) - Number(a.featured) || a.featuredPosition - b.featuredPosition || a.name.localeCompare(b.name)).slice(0, take)
prisma.product.findMany = async ({ take, where = {} } = {}) => where.categoryId?.in?.length === 0 ? [] : productRows.slice(0, take)

const requests = []
const app = express()
app.use(express.json())
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5176')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  requests.push(`${req.method} ${req.path}`)
  next()
})
app.use('/fixtures', (req, res) => {
  const isScene = req.path.includes('scene')
  res.type('svg').send(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="750" viewBox="0 0 1000 750"><rect width="1000" height="750" fill="${isScene ? '#102d45' : '#e0e7ff'}"/><circle cx="760" cy="200" r="210" fill="#348a9c"/><path d="M0 650 Q400 350 1000 570 V750 H0Z" fill="#3d5afe"/><rect x="${isScene ? 620 : 360}" y="200" width="210" height="350" rx="25" fill="#16324a" stroke="#b9e1ed" stroke-width="12"/><circle cx="${isScene ? 725 : 465}" cy="500" r="12" fill="#b9e1ed"/></svg>`)
})
app.post('/api/auth/login', (req, res) => res.json({ user, token: signToken({ sub: user.id, tokenVersion: 0 }) }))
app.get('/api/auth/me', (req, res) => res.json({ user }))
// These are the actual production route handlers, backed only by in-memory delegates.
app.use('/api/admin', (req, res, next) => req.path === '/home-layout' ? adminContentRouter(req, res, next) : next())
app.use('/api', (req, res, next) => req.path === '/home' ? contentRouter(req, res, next) : next())
app.get('/api/site-settings', (req, res) => res.json(settings))
app.get('/api/categories/tree', (req, res) => res.json(categoryRows.map(c => ({ ...c, children: [] }))))
app.get('/api/categories', (req, res) => res.json(categoryRows))
app.get('/api/products', (req, res) => res.json(productRows.map(serializeProduct)))
app.get('/api/brands', (req, res) => res.json({ all: brandRows.filter(b => b.visible), featured: brandRows.filter(b => b.visible && b.featured) }))
app.get('/api/nav', (req, res) => res.json({ menus: { acuerdos: [], soporte: [], descubre: [], mas: [], quick: [] }, seasonalPromo: null }))
app.get('/api/popular-searches', (req, res) => res.json([]))
app.get('/api/stores', (req, res) => res.json([]))
app.get('/api/cart', (req, res) => res.json({ items: [] }))
app.get('/api/saved', (req, res) => res.json({ productIds: [] }))
app.get('/__qa/state', (req, res) => res.json({ layout, requests }))
app.use((req, res) => res.status(404).json({ error: 'Ruta no incluida en QA local' }))
const api = await new Promise(resolve => { const server = app.listen(4406, '127.0.0.1', () => resolve(server)) })
const vite = await createServer({ envFile: false, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(origin) },
  server: { host: '127.0.0.1', port: 5176, strictPort: true,
    headers: { 'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http://127.0.0.1:4406; connect-src 'self' ws://127.0.0.1:5176 http://127.0.0.1:4406; font-src 'self' data:; frame-src 'none'" } },
})
await vite.listen()
console.log('Home 5b QA: http://127.0.0.1:5176; local ADMIN login uses any synthetic values; no DB')
const stop = async () => { await vite.close(); api.close(); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
