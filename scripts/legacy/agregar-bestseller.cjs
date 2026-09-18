// Script de un solo uso: agrega bestSeller: true a productos reales
// existentes por su id, sin tocar nada más de sus datos.
// Se ejecuta con: node agregar-bestseller.cjs

const fs = require('fs')
const path = require('path')

const RUTA_ARCHIVO = path.join(__dirname, '..', '..', 'src', 'data', 'products.js')

const IDS_BEST_SELLER = ['cg09', 'cb13', 'ad01', 'ac09', 'ac41', 'ac54']

function main() {
  let texto = fs.readFileSync(RUTA_ARCHIVO, 'utf8')

  const marcadores = []
  const regexId = /\n(\s*)id: '([a-zA-Z0-9]+)',/g
  let m
  while ((m = regexId.exec(texto)) !== null) {
    marcadores.push({ id: m[2], inicio: m.index })
  }

  let actualizados = 0
  for (let i = marcadores.length - 1; i >= 0; i--) {
    const { id, inicio } = marcadores[i]
    if (!IDS_BEST_SELLER.includes(id)) continue

    const finBloque = i + 1 < marcadores.length ? marcadores[i + 1].inicio : texto.length
    let bloque = texto.slice(inicio, finBloque)

    if (bloque.includes('bestSeller:')) continue // ya lo tiene, no duplicar

    const idxFeatured = bloque.search(/\n\s*featured: (true|false),/)
    const idxFinLinea = bloque.indexOf('\n', idxFeatured + 1)
    bloque = bloque.slice(0, idxFinLinea) + '\n    bestSeller: true,' + bloque.slice(idxFinLinea)

    texto = texto.slice(0, inicio) + bloque + texto.slice(finBloque)
    actualizados++
  }

  fs.writeFileSync(RUTA_ARCHIVO, texto, 'utf8')
  console.log(`Listo. Se marcaron ${actualizados} de ${IDS_BEST_SELLER.length} productos como bestSeller.`)
}

main()