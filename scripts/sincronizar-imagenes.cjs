// Script reutilizable: trae TODAS las imágenes de Cloudinary, las agrupa
// por código de producto, y actualiza products.js automáticamente
// emparejando por el campo "Código" de cada producto.
// Se ejecuta con: node sincronizar-imagenes.cjs

const fs = require('fs')
const path = require('path')

// Carga variables desde .env en la raíz del proyecto (soporte nativo de
// Node, sin depender del paquete "dotenv"). Si el archivo no existe,
// sigue igual — puede que las variables ya estén exportadas en el shell.
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'))
} catch {
  // No hay .env en la raíz: seguimos con lo que ya esté en process.env.
}

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error(
    'Faltan credenciales de Cloudinary. Copia .env.example a .env en la raíz del proyecto\n' +
      'y completa CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
  )
  process.exit(1)
}

const RUTA_ARCHIVO = path.join(__dirname, '..', 'src', 'data', 'products.js')

async function obtenerTodosLosRecursos() {
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64')
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`
  let recursos = []
  let cursor = undefined

  do {
    const body = { expression: 'asset_folder:tecruta/*', max_results: 500 }
    if (cursor) body.next_cursor = cursor
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('Error consultando Cloudinary:', res.status, await res.text())
      break
    }
    const data = await res.json()
    recursos = recursos.concat(data.resources || [])
    cursor = data.next_cursor
  } while (cursor)

  return recursos
}

function extraerCodigo(assetFolder) {
  if (!assetFolder) return null
  // Quita tildes (á, é, í, ó, ú → a, e, i, o, u) para que "Código" y
  // "codigo" se traten igual, sin importar cómo se haya escrito.
  const normalizado = assetFolder.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Acepta "codigo-XXXXX", "codigo XXXXX" o "codigoXXXXX" (guion, espacio o nada entre medio).
  const match = normalizado.match(/codigo[-\s]?([a-z0-9]+)/i)
  return match ? match[1].toLowerCase() : null
}

function normalizar(codigo) {
  return (codigo || '').toLowerCase().trim()
}

async function main() {
  console.log('Consultando Cloudinary...')
  const recursos = await obtenerTodosLosRecursos()
  console.log(`Se encontraron ${recursos.length} imágenes en total.\n`)

      const imagenesPorCodigo = {}
  const sinCarpetaReconocida = []
  for (const r of recursos) {
    const codigo = extraerCodigo(r.asset_folder)
    if (!codigo) {
      sinCarpetaReconocida.push({ publicId: r.public_id, asset_folder: r.asset_folder })
      continue
    }
    if (!imagenesPorCodigo[codigo]) imagenesPorCodigo[codigo] = []
    imagenesPorCodigo[codigo].push({
      publicId: r.public_id,
      url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_800,q_auto,f_auto/${r.public_id}`,
    })
  }

  // Orden estable: alfabético por el nombre del archivo (no por lo que
  // devuelva Cloudinary, que puede variar entre ejecuciones). Un archivo
  // cuyo nombre empiece con "0-" siempre queda primero — así defines
  // manualmente la portada renombrando la foto antes de subirla.
  for (const codigo of Object.keys(imagenesPorCodigo)) {
    imagenesPorCodigo[codigo].sort((a, b) => a.publicId.localeCompare(b.publicId))
    imagenesPorCodigo[codigo] = imagenesPorCodigo[codigo].map((r) => r.url)
  }
    if (sinCarpetaReconocida.length > 0) {
    console.log(`\nAVISO: ${sinCarpetaReconocida.length} imagen(es) en Cloudinary no están dentro de una carpeta "codigo-XXXXX" reconocible:`)
    sinCarpetaReconocida.slice(0, 15).forEach((r) => console.log(`  - ${r.publicId}  (carpeta: ${r.asset_folder || '(sin carpeta)'})`))
    if (sinCarpetaReconocida.length > 15) console.log(`  ...y ${sinCarpetaReconocida.length - 15} más.`)
  }
  // Lee todos los códigos válidos que existen en products.js, para
  // detectar carpetas de Cloudinary que no coinciden con ningún producto
  // (típicamente por un error de tipeo en el nombre de la carpeta).
  const textoProductos = fs.readFileSync(RUTA_ARCHIVO, 'utf8')
  const codigosValidos = new Set(
    [...textoProductos.matchAll(/label:\s*'Código',\s*value:\s*'([^']+)'/g)].map((m) => normalizar(m[1])),
  )
  const codigosSinProducto = Object.keys(imagenesPorCodigo).filter((c) => !codigosValidos.has(c))
  if (codigosSinProducto.length > 0) {
    console.log(`\nAVISO: hay carpetas en Cloudinary cuyo código no coincide con ningún producto (revisa el nombre exacto de la carpeta):`)
    codigosSinProducto.forEach((c) => console.log(`  - codigo-${c} (${imagenesPorCodigo[c].length} foto(s))`))
  }

  let texto = fs.readFileSync(RUTA_ARCHIVO, 'utf8')

  const marcadores = []
  const regexId = /\n(\s*)id: '([a-zA-Z0-9]+)',/g
  let m
  while ((m = regexId.exec(texto)) !== null) {
    marcadores.push({ id: m[2], inicio: m.index })
  }

  let actualizados = 0
  let sinCoincidencia = []

  for (let i = marcadores.length - 1; i >= 0; i--) {
    const { id, inicio } = marcadores[i]
    const finBloque = i + 1 < marcadores.length ? marcadores[i + 1].inicio : texto.length
    let bloque = texto.slice(inicio, finBloque)

    const matchCodigo = bloque.match(/label:\s*'Código',\s*value:\s*'([^']+)'/)
    if (!matchCodigo) continue

    const codigoProducto = normalizar(matchCodigo[1])
    const urls = imagenesPorCodigo[codigoProducto]
    if (!urls || urls.length === 0) {
      sinCoincidencia.push(`${id} (código ${matchCodigo[1]})`)
      continue
    }

    bloque = bloque.replace(/\n\s*image:\s*'[^']*',/, '')
    bloque = bloque.replace(/\n\s*images:\s*\[[\s\S]*?\],(?=\n)/, '')

    const listaImagenes = urls.map((u) => `      '${u}',`).join('\n')
    const bloqueImagenes = `\n    image: '${urls[0]}',` + `\n    images: [\n${listaImagenes}\n    ],`

    const idxFeatured = bloque.indexOf('featured:')
    const idxFinLineaFeatured = bloque.indexOf('\n', idxFeatured)
    bloque = bloque.slice(0, idxFinLineaFeatured) + bloqueImagenes + bloque.slice(idxFinLineaFeatured)

    texto = texto.slice(0, inicio) + bloque + texto.slice(finBloque)
    actualizados++
  }

  fs.writeFileSync(RUTA_ARCHIVO, texto, 'utf8')
  console.log(`Listo. Se actualizaron ${actualizados} productos con fotos reales.`)
  if (sinCoincidencia.length > 0) {
    console.log(`\n${sinCoincidencia.length} productos todavía sin fotos subidas a Cloudinary:`)
    console.log(sinCoincidencia.join(', '))
  }
}

main()