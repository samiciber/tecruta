import crypto from 'crypto'

// Sube archivos a Cloudinary usando una petición firmada (más seguro
// que un "unsigned upload preset": no requiere configurar nada extra en
// el dashboard de Cloudinary, solo las credenciales que ya usa
// scripts/sincronizar-imagenes.cjs).
//
// Reutiliza las mismas variables de entorno que ese script:
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.

function buildSignature(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
}

function getCredentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary no está configurado en el servidor: faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET en server/.env.',
    )
  }
  return { cloudName, apiKey, apiSecret }
}

// `dataUrl` debe ser una data URL completa, ej: "data:image/png;base64,...."
// (es justo lo que produce FileReader.readAsDataURL en el navegador).
// `resourceType`: 'image' para fotos de producto, 'raw' para cualquier
// otro archivo binario (usado por los modelos .glb/.gltf — Cloudinary no
// los reconoce como "image" ni "video").
async function uploadToCloudinary({ dataUrl, resourceType = 'image', folder = 'tecruta/products' }) {
  const { cloudName, apiKey, apiSecret } = getCredentials()

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildSignature({ folder, timestamp }, apiSecret)

  const body = new URLSearchParams({
    file: dataUrl,
    api_key: apiKey,
    timestamp: String(timestamp),
    folder,
    signature,
  })

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Cloudinary respondió con estado ${response.status}: ${detail}`)
  }

  const data = await response.json()
  return data.secure_url
}

export async function uploadImageToCloudinary(dataUrl) {
  return uploadToCloudinary({ dataUrl, resourceType: 'image', folder: 'tecruta/products' })
}

// Modelos 3D (.glb/.gltf) — van a una carpeta separada de las imágenes y
// se suben como "raw" (Cloudinary no los procesa como imagen/video, solo
// los aloja tal cual).
export async function uploadModelToCloudinary(dataUrl) {
  return uploadToCloudinary({ dataUrl, resourceType: 'raw', folder: 'tecruta/products/models' })
}

