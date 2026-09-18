import fs from 'fs'
import path from 'path'

const RUTA_ARCHIVO = path.join(process.cwd(), 'src', 'data', 'products.js')

const IDS_POWER_BANKS = [
  'ac31', 'ac32', 'ac33', 'ac34', 'ac35', 'ac36', 'ac37', 'ac38', 'ac39', 'ac40',
  'ac41', 'ac42', 'ac43', 'ac44', 'ac45', 'ac46', 'ac47', 'ac48', 'ac49', 'ac50',
  'ac51', 'ac52', 'ac53', 'ac54',
]

function main() {
  let texto = fs.readFileSync(RUTA_ARCHIVO, 'utf8')

  const marcadores = []
  const regexId = /\n(\s*)id: '([a-zA-Z0-9]+)',/g
  let m
  while ((m = regexId.exec(texto)) !== null) {
    marcadores.push({ id: m[2], inicio: m.index })
  }

  let movidos = 0
  for (let i = marcadores.length - 1; i >= 0; i--) {
    const { id, inicio } = marcadores[i]
    if (!IDS_POWER_BANKS.includes(id)) continue

    const finBloque = i + 1 < marcadores.length ? marcadores[i + 1].inicio : texto.length
    let bloque = texto.slice(inicio, finBloque)

    if (!bloque.includes("category: 'accesorios',")) {
      console.log(`Aviso: ${id} no tenía category: 'accesorios' — se dejó sin tocar.`)
      continue
    }

    bloque = bloque.replace("category: 'accesorios',", "category: 'power-banks',")
    texto = texto.slice(0, inicio) + bloque + texto.slice(finBloque)
    movidos++
  }

  fs.writeFileSync(RUTA_ARCHIVO, texto, 'utf8')
  console.log(`\nListo. Se movieron ${movidos} de ${IDS_POWER_BANKS.length} productos a 'power-banks'.`)
}

main()