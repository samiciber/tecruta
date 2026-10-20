import compression from 'compression'
import { createHash } from 'node:crypto'

const publicPaths = /^\/api\/(?:home|products(?:\/[^/]+)?|categories(?:\/[^/]+)?|brands|nav|popular-searches|stores|site-settings|footer|legal\/(?:terminos|privacidad)|reviews\/(?:recent|products\/[^/]+))$/
export function isPublicRead(req) {
  const path = (req.originalUrl || req.path).split('?')[0]
  return ['GET', 'HEAD'].includes(req.method) && !req.headers.authorization && !req.headers.cookie && publicPaths.test(path)
}
export const publicCompression = () => compression({
  threshold: 1024,
  filter: (req, res) => isPublicRead(req) && res.statusCode === 200 && compression.filter(req, res),
})
export function publicResponsePolicy(req, res, next) {
  res.set('Cache-Control', 'private, no-store')
  const json = res.json
  res.json = function sendPublicJson(body) {
    if (!isPublicRead(req) || res.statusCode !== 200) {
      res.set('Cache-Control', 'private, no-store')
      return json.call(this, body)
    }
    // Weak validator remains valid for gzip/br variants of the same JSON.
    const etag = 'W/"' + createHash('sha256').update(JSON.stringify(body)).digest('hex') + '"'
    res.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60')
    res.set('ETag', etag)
    const validators = String(req.headers['if-none-match'] || '').split(',').map(value => value.trim().replace(/^W\//, ''))
    if (validators.includes(etag.replace(/^W\//, '')) || validators.includes('*')) return res.status(304).end()
    return json.call(this, body)
  }
  next()
}
