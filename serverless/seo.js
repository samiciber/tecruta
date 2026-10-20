import { escapeMarkup, safeJsonLd, pageMetadata, productStructuredData, organizationStructuredData, publicRoute, DEFAULT_STORE_ORIGIN } from '../src/utils/seo.js'
import { createHash } from 'node:crypto'

export const MAX_JSON_BYTES = 3 * 1024 * 1024
export async function fetchPublicJson(path) {
  // Neither Host nor a user query can select the upstream origin.
  const base = new URL(process.env.PUBLIC_API_ORIGIN || 'https://tecruta.onrender.com')
  if (base.protocol !== 'https:' || base.username || base.password) throw Error('Invalid public API origin')
  const response = await fetch(new URL(path, base.origin), { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { Accept: 'application/json' } })
  if (!response.ok) throw Error('Public API unavailable')
  if (Number(response.headers.get('content-length')) > MAX_JSON_BYTES) throw Error('Public API response too large')
  let length = 0
  const chunks = []
  for await (const chunk of response.body) {
    length += chunk.length
    if (length > MAX_JSON_BYTES) { await response.body.cancel().catch(() => {}); throw Error('Public API response too large') }
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export function authorizedHost(req, origin) {
  const host = String(req.headers?.host || '').split(':')[0].toLowerCase()
  const expected = new URL(origin).hostname
  return host === expected || (expected.startsWith('www.') && host === expected.slice(4))
}
export function sendBody(req, res, body, type, status = 200) {
  res.setHeader('Content-Type', type + '; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Vary', 'User-Agent')
  res.setHeader('Cache-Control', status === 200 && type !== 'text/html' ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=120' : 'private, no-store')
  const etag = '"' + createHash('sha256').update(body).digest('hex') + '"'
  res.setHeader('ETag', etag)
  if (status === 200 && req.headers?.['if-none-match'] === etag) { res.statusCode = 304; return res.end() }
  res.statusCode = status
  return res.end(req.method === 'HEAD' ? undefined : body)
}
export function createShareHandler({ load = fetchPublicJson, origin = process.env.SEO_STORE_ORIGIN || DEFAULT_STORE_ORIGIN } = {}) {
  return async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) return sendBody(req, res, 'Método no permitido', 'text/plain', 405)
    const path = new URL(req.url, origin).searchParams.get('path') || '/'
    if (!authorizedHost(req, origin) || !publicRoute(path)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      return sendBody(req, res, 'Página no disponible', 'text/plain', 404)
    }
    try {
      const [, type, encoded] = path.split('/')
      if (encoded) {
        const decoded = decodeURIComponent(encoded)
        if (decoded.length > 200 || /[/\\\u0000-\u001f]/.test(decoded) || ['.', '..'].includes(decoded)) return sendBody(req, res, 'Página no encontrada', 'text/plain', 404)
      }
      let entity, schema
      if (type === 'producto' || type === 'categoria') entity = await load('/api/' + (type === 'producto' ? 'products' : 'categories') + '/' + encodeURIComponent(decodeURIComponent(encoded)))
      if (type === 'marca') entity = (await load('/api/brands')).all.find(row => row.slug === decodeURIComponent(encoded))
      if (type === 'legal') entity = await load('/api/legal/' + encodeURIComponent(encoded))
      if (['producto', 'categoria', 'marca'].includes(type) && !entity) return sendBody(req, res, 'Página no encontrada', 'text/plain', 404)
      if (type === 'producto') {
        schema = productStructuredData(entity, origin)
        // Review text comes only from the public, moderated endpoint.
        if (schema.aggregateRating) {
          const reviews = await load('/api/reviews/products/' + encodeURIComponent(entity.id) + '?limit=3')
          schema.review = reviews.items.map(row => ({ '@type': 'Review', author: { '@type': 'Person', name: row.name }, reviewBody: row.text, datePublished: row.createdAt,
            reviewRating: { '@type': 'Rating', ratingValue: row.rating, bestRating: 5, worstRating: 1 } }))
        }
      }
      if (path === '/') schema = organizationStructuredData((await load('/api/site-settings')).storeBusiness, origin)
      const meta = pageMetadata(path, { entity, origin })
      if (type === 'legal' && !entity?.body?.trim()) {
        meta.noindex = true
        res.setHeader('X-Robots-Tag', 'noindex, follow')
      }
      const head = `<title>${escapeMarkup(meta.title)}</title><meta name="description" content="${escapeMarkup(meta.description)}"><link rel="canonical" href="${escapeMarkup(meta.canonical)}"><meta property="og:title" content="${escapeMarkup(meta.title)}"><meta property="og:description" content="${escapeMarkup(meta.description)}"><meta property="og:type" content="${meta.type}"><meta property="og:url" content="${escapeMarkup(meta.canonical)}"><meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${escapeMarkup(meta.title)}"><meta name="twitter:description" content="${escapeMarkup(meta.description)}">${meta.image ? `<meta property="og:image" content="${escapeMarkup(meta.image)}"><meta name="twitter:image" content="${escapeMarkup(meta.image)}">` : ''}${schema ? `<script type="application/ld+json">${safeJsonLd(schema)}</script>` : ''}`
      const body = `<!doctype html><html lang="es-PE"><head><meta charset="utf-8">${head}${meta.noindex ? '<meta name="robots" content="noindex, follow">' : ''}</head><body><h1>${escapeMarkup(entity?.name || entity?.title || meta.title)}</h1><p>${escapeMarkup(type === 'legal' ? entity?.body?.trim() || 'Este documento aún no está publicado.' : meta.description)}</p>${type === 'producto' ? `<p>Precio: S/ ${Number(entity.price).toFixed(2)}. ${entity.stock > 0 ? 'Disponible' : 'Agotado'}.</p>` : ''}<a href="${escapeMarkup(meta.canonical)}">Ver en TecRuta</a></body></html>`
      return sendBody(req, res, body, 'text/html')
    } catch { return sendBody(req, res, 'Información temporalmente no disponible', 'text/plain', 503) }
  }
}
export function createSitemapHandler({ load = fetchPublicJson, origin = process.env.SEO_STORE_ORIGIN || DEFAULT_STORE_ORIGIN } = {}) {
  return async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) return sendBody(req, res, 'Método no permitido', 'text/plain', 405)
    if (!authorizedHost(req, origin)) return sendBody(req, res, 'No disponible', 'text/plain', 404)
    try {
      const [products, tree, brands] = await Promise.all([load('/api/products?view=cards'), load('/api/categories/tree'), load('/api/brands')])
      const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])])
      const urls = ['/', ...flatten(tree).filter(row => row.visible !== false).map(row => '/categoria/' + encodeURIComponent(row.slug)),
        ...brands.all.filter(row => row.visible !== false).map(row => '/marca/' + encodeURIComponent(row.slug)),
        ...products.filter(row => row.published !== false).map(row => '/producto/' + encodeURIComponent(row.slug))]
      const unique = [...new Set(urls)]
      if (unique.length > 5000) throw Error('Sitemap limit; split index required')
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${unique.map(path => `<url><loc>${escapeMarkup(new URL(path, origin).href)}</loc></url>`).join('')}</urlset>`
      if (Buffer.byteLength(xml) > 2 * 1024 * 1024) throw Error('Sitemap too large')
      return sendBody(req, res, xml, 'application/xml')
    } catch { return sendBody(req, res, 'Mapa temporalmente no disponible', 'text/plain', 503) }
  }
}
