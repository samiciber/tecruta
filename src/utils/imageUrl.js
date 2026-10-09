// Optimización de imágenes servidas desde Cloudinary: inserta f_auto (WebP/AVIF
// según el navegador), q_auto y un ancho máximo. Las URLs que no son de
// Cloudinary, o que ya traen transformaciones, se devuelven tal cual.
const CLOUDINARY = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/

export function isCloudinary(url) {
  return typeof url === 'string' && CLOUDINARY.test(url)
}

export function optimizeImage(url, width) {
  if (!url) return url
  const m = url.match(CLOUDINARY)
  if (!m) return url
  if (/^[a-z]{1,3}_[^/]*\//.test(m[2])) return url // ya trae transformaciones
  return `${m[1]}f_auto,q_auto,w_${width}/${m[2]}`
}

// srcset solo si es Cloudinary (en otro host no hay forma de pedir otro tamaño).
export function imageSrcSet(url, widths) {
  if (!isCloudinary(url)) return undefined
  return widths.map((w) => `${optimizeImage(url, w)} ${w}w`).join(', ')
}