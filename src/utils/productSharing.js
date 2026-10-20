export function productShareUrl(slug, origin) {
  const base = new URL(origin)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw Error('Invalid store origin')
  return new URL('/producto/' + encodeURIComponent(slug), base.origin).href
}
