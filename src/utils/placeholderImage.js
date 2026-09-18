// Genera imágenes de producto localmente como SVG (data URI).
// Esto asegura que el catálogo funcione sin conexión a internet ni
// imágenes externas rotas. Cuando existan fotos reales, basta con
// reemplazar el campo `image` / `images` en data/products.js por la
// ruta del archivo real (por ejemplo "/images/producto.jpg").

const PALETTES = [
  ['#3D5AFE', '#8FA0FF'],
  ['#12A150', '#7BD9A5'],
  ['#C77D19', '#F0B96B'],
  ['#7C3AED', '#C4B0FA'],
  ['#0EA5B7', '#8FE1EA'],
  ['#D64545', '#F4A0A0'],
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Íconos simples en trazo, dibujados a mano para no depender de una librería en tiempo de generación de datos.
const GLYPHS = {
  cargadores:
    '<path d="M60 30 L45 62 H58 L48 90 L82 52 H66 L78 30 Z" fill="white" fill-opacity="0.92"/>',
  cables:
    '<path d="M30 40 C30 30 40 30 40 40 V70 C40 80 50 80 50 70 V50 M50 50 C50 40 60 40 60 50 V80 C60 90 70 90 70 80 V60" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.92"/>',
  audifonos:
    '<path d="M30 62 A30 30 0 0 1 90 62 V78" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.92"/><rect x="22" y="60" width="16" height="24" rx="6" fill="white" opacity="0.92"/><rect x="82" y="60" width="16" height="24" rx="6" fill="white" opacity="0.92"/>',
  accesorios:
    '<rect x="30" y="40" width="60" height="40" rx="8" fill="white" opacity="0.92"/><circle cx="45" cy="60" r="5" fill="#14171F"/><circle cx="60" cy="60" r="5" fill="#14171F"/><circle cx="75" cy="60" r="5" fill="#14171F"/>',
  celulares:
    '<rect x="42" y="24" width="36" height="72" rx="8" fill="white" opacity="0.92"/><rect x="48" y="32" width="24" height="48" rx="2" fill="#14171F" opacity="0.5"/>',
  tablets:
    '<rect x="30" y="28" width="60" height="64" rx="8" fill="white" opacity="0.92"/><rect x="36" y="36" width="48" height="42" rx="2" fill="#14171F" opacity="0.5"/>',
  laptops:
    '<rect x="28" y="34" width="64" height="40" rx="4" fill="white" opacity="0.92"/><rect x="22" y="76" width="76" height="8" rx="4" fill="white" opacity="0.7"/>',
}

export function placeholderImage(seed, category = 'accesorios') {
  const idx = hashString(seed) % PALETTES.length
  const [from, to] = PALETTES[idx]
  const glyph = GLYPHS[category] || GLYPHS.accesorios
  const gradId = `g-${hashString(seed)}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="16" fill="url(#${gradId})"/>
    ${glyph}
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
