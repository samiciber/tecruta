// Synthetic component markup checks; no browser interaction or production data.
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { catalogFacets } from '../src/utils/catalogFilters.js'
const server = await createServer({
  envFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  ssr: { noExternal: ['lucide-react'] },
})
try {
  const { default: FilterPanel } = await server.ssrLoadModule(
    '/src/components/filters/FilterPanel.jsx',
  )
  const { default: ActiveFilters } = await server.ssrLoadModule(
    '/src/components/filters/ActiveFilters.jsx',
  )
  const products = [
    {
      brand: 'UGREEN',
      category: 'cargadores',
      price: 50,
      stock: 2,
      filterAttributes: { potencia: '30 W' },
    },
    {
      brand: 'UGREEN',
      category: 'cargadores',
      price: 90,
      stock: 1,
      filterAttributes: { potencia: '65 W' },
    },
    { brand: 'Otra', category: 'laptops', price: 2000, stock: 0 },
  ]
  const tree = [
    { name: 'Cargadores', slug: 'cargadores' },
    { name: 'Laptops', slug: 'laptops' },
  ]
  const filters = { brands: ['UGREEN'], category: 'cargadores', attributes: { potencia: ['65 W'] } }
  const facets = catalogFacets(products, tree, filters)
  const props = {
    filters,
    facets,
    priceBounds: { min: 50, max: 2000 },
    onChange() {},
    onClear() {},
  }
  const html = renderToStaticMarkup(React.createElement(FilterPanel, props))
  assert.ok(html.includes('Cargadores'))
  assert.ok(!html.includes('Laptops'))
  assert.ok(html.includes('Potencia'))
  assert.ok(html.includes('30 W'))
  assert.ok(html.includes('65 W'))
  assert.ok(html.includes('<details open=""'))
  assert.ok(html.includes('Precio mínimo'))
  assert.ok(html.includes('Precio máximo'))
  const chips = renderToStaticMarkup(
    React.createElement(ActiveFilters, { filters, categoryName: 'Cargadores', onChange() {} }),
  )
  for (const label of [
    'Quitar filtro UGREEN',
    'Quitar filtro Cargadores',
    'Quitar filtro Potencia: 65 W',
  ])
    assert.ok(chips.includes(label))
  const scoped = renderToStaticMarkup(
    React.createElement(FilterPanel, { ...props, hideBrands: true }),
  )
  assert.ok(!scoped.includes('>Marca<'))
  assert.ok(scoped.includes('Cargadores'))
  console.log(
    'OK: marca y categorías contextuales, atributos reales, grupos plegables, precio y chips removibles',
  )
} finally {
  await server.close()
}
