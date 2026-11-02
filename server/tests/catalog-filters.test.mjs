import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogFacets,
  matchesCatalogFilters,
  productFilterAttributes,
  readAttributeFilters,
  writeAttributeFilters,
} from '../../src/utils/catalogFilters.js'

const tree = [
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    children: [
      { slug: 'baterias', name: 'Baterías' },
      { slug: 'cargadores', name: 'Cargadores' },
      { slug: 'cables', name: 'Cables' },
      { slug: 'laptops', name: 'Laptops' },
    ],
  },
]
const products = [
  {
    id: '1',
    name: 'QA batería',
    brand: 'UGREEN',
    category: 'baterias',
    price: 100,
    stock: 4,
    filterAttributes: { capacidad: '10000 mAh' },
  },
  {
    id: '2',
    name: 'QA cargador',
    brand: 'UGREEN',
    category: 'cargadores',
    price: 70,
    stock: 0,
    filterAttributes: { potencia: '30 W' },
  },
  {
    id: '3',
    name: 'QA cargador grande',
    brand: 'UGREEN',
    category: 'cargadores',
    price: 150,
    stock: 2,
    filterAttributes: { potencia: '65 W' },
  },
  { id: '4', name: 'QA cable', brand: 'Anker', category: 'cables', price: 20, stock: 8 },
  {
    id: '5',
    name: 'QA laptop',
    brand: 'Asus',
    category: 'laptops',
    price: 2000,
    stock: 1,
    filterAttributes: { ram: '16 GB' },
  },
]
test('marca muestra solo sus categorías y ancestros; nunca mezcla categorías ajenas', () => {
  const facets = catalogFacets(products, tree, { brands: ['UGREEN'] })
  assert.deepEqual(
    facets.categories.map((c) => [c.slug, c.count]),
    [
      ['tecnologia', 3],
      ['baterias', 1],
      ['cargadores', 2],
    ],
  )
  assert.equal(facets.attributes.length, 0)
  assert.deepEqual(
    catalogFacets(products, tree, { brands: ['UGREEN'], inStockOnly: true }).categories.map((c) => [
      c.slug,
      c.count,
    ]),
    [
      ['tecnologia', 2],
      ['baterias', 1],
      ['cargadores', 1],
    ],
  )
})
test('conteos excluyen su propia dimensión y mantienen opciones seleccionadas sin resultados', () => {
  const filters = { brands: ['UGREEN'], category: 'cargadores', attributes: { potencia: ['30 W'] } }
  const facets = catalogFacets(products, tree, filters)
  assert.deepEqual(facets.attributes.find((f) => f.key === 'potencia').options, [
    { value: '30 W', count: 1 },
    { value: '65 W', count: 1 },
  ])
  assert.deepEqual(
    products.filter((p) => matchesCatalogFilters(p, filters)).map((p) => p.id),
    ['2'],
  )
  assert.equal(
    products.filter((p) => matchesCatalogFilters(p, { ...filters, inStockOnly: true })).length,
    0,
  )
  const empty = catalogFacets(products, tree, { ...filters, minPrice: 500 })
  assert.equal(empty.brands.find((b) => b.value === 'UGREEN').count, 0)
  assert.equal(empty.categories.find((c) => c.slug === 'cargadores').count, 0)
  assert.equal(empty.attributes[0].options[0].value, '30 W')
})
test('jerarquía, precio, múltiples marcas/atributos y búsqueda combinan AND/OR correctamente', () => {
  assert.equal(
    products.filter((p) =>
      matchesCatalogFilters(p, {
        categorySlugs: ['tecnologia', 'baterias', 'cargadores'],
        brands: ['UGREEN', 'Anker'],
        minPrice: 80,
        maxPrice: 160,
      }),
    ).length,
    2,
  )
  assert.equal(
    products.filter((p) => matchesCatalogFilters(p, { attributes: { potencia: ['30 W', '65 W'] } }))
      .length,
    2,
  )
  assert.equal(products.filter((p) => matchesCatalogFilters(p, {}, 'bateria')).length, 1)
})
test('atributos solo proceden de fichas cortas explícitas y URL conserva comas, unidades y espacios', () => {
  assert.deepEqual(
    productFilterAttributes([
      { label: 'Memoria RAM', value: ' 16  GB ' },
      { label: 'Modelo', value: 'NO' },
      { label: 'Pantalla', value: '15,6 pulgadas' },
      { label: 'Potencia', value: 'x'.repeat(61) },
      { label: 'CPU', value: '<b>Intel</b>' },
    ]),
    { ram: '16 GB', pantalla: '15,6 pulgadas' },
  )
  const params = new URLSearchParams('q=cable&f_antiguo=x')
  writeAttributeFilters(params, { pantalla: ['15,6 pulgadas'], ram: ['8 GB', '16 GB'] })
  assert.deepEqual(readAttributeFilters(params), {
    ram: ['8 GB', '16 GB'],
    pantalla: ['15,6 pulgadas'],
  })
  assert.equal(params.get('q'), 'cable')
  assert.equal(params.has('f_antiguo'), false)
})
