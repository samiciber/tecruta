import { OrderError } from './orderPolicy.js'

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024
export const MODEL_MAX_BYTES = 15 * 1024 * 1024
export function decodeDataUrl(value, maxBytes) {
  if (typeof value !== 'string') throw new OrderError(400, 'Envía un archivo como data URL en base64.')
  const comma = value.indexOf(',')
  const header = value.slice(0, comma)
  if (comma < 0 || !/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64$/i.test(header)) throw new OrderError(400, 'Formato de archivo inválido.')
  const base64 = value.slice(comma + 1)
  if (base64.length > Math.ceil(maxBytes / 3) * 4) throw new OrderError(413, 'El archivo supera el tamaño permitido.')
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new OrderError(400, 'El archivo no contiene base64 válido.')
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length > maxBytes) throw new OrderError(413, 'El archivo supera el tamaño permitido.')
  if (bytes.toString('base64') !== base64) throw new OrderError(400, 'El archivo no contiene base64 válido.')
  return { bytes, mime: header.slice(5, -7).toLowerCase() }
}
function detectMime(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR') return 'image/png'
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 10 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif'
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.readUInt32LE(4) + 8 === bytes.length && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return 'image/webp'
  if (/^%PDF-(?:1\.[0-7]|2\.0)/.test(bytes.toString('ascii', 0, 8)) && /%%EOF\s*$/.test(bytes.subarray(-1024).toString('ascii'))) return 'application/pdf'
  return null
}
export function validateUpload(value, { receipt = false } = {}) {
  const decoded = decodeDataUrl(value, receipt ? RECEIPT_MAX_BYTES : IMAGE_MAX_BYTES)
  const detected = detectMime(decoded.bytes)
  if (!detected || detected !== decoded.mime || (!receipt && detected === 'application/pdf')) {
    throw new OrderError(400, receipt ? 'El comprobante debe ser JPEG, PNG, GIF, WebP o PDF válido.' : 'La imagen debe ser JPEG, PNG, GIF o WebP válido.')
  }
  return decoded
}
export function validateModel(value, filename) {
  const { bytes, mime } = decodeDataUrl(value, MODEL_MAX_BYTES)
  const ext = typeof filename === 'string' ? filename.toLowerCase().split('.').pop() : ''
  const allowed = ext === 'glb' ? ['application/octet-stream', 'model/gltf-binary'] : ['application/octet-stream', 'application/json', 'model/gltf+json']
  if (!allowed.includes(mime)) throw new OrderError(400, 'El tipo del modelo no es GLB o glTF.')
  if (ext === 'glb' && bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'glTF' && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length) {
    try {
      let offset = 12
      let chunks = 0
      while (offset < bytes.length) {
        if (offset + 8 > bytes.length || chunks > 1) break
        const length = bytes.readUInt32LE(offset)
        const type = bytes.toString('ascii', offset + 4, offset + 8)
        if (length % 4 !== 0 || offset + 8 + length > bytes.length || type !== (chunks === 0 ? 'JSON' : 'BIN\0')) break
        if (chunks === 0 && JSON.parse(bytes.toString('utf8', offset + 8, offset + 8 + length))?.asset?.version !== '2.0') break
        offset += 8 + length
        chunks++
      }
      if (chunks > 0 && offset === bytes.length) return
    } catch {}
  }
  if (ext === 'gltf') {
    try { if (JSON.parse(bytes.toString('utf8'))?.asset?.version === '2.0') return } catch {}
  }
  throw new OrderError(400, 'El modelo debe ser un archivo GLB o glTF 2.0 válido.')
}
