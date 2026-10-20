import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productShareUrl } from '../../src/utils/productSharing.js'
import { breadcrumbStructuredData } from '../../src/utils/seo.js'

test('compartir construye solo la ruta del producto y nunca propaga query ni tokens', () => {
  assert.equal(productShareUrl('cable-qa', 'https://shop.example.test?token=qa-private'), 'https://shop.example.test/producto/cable-qa')
  const url = new URL(productShareUrl('qa?token=private#fragment', 'https://shop.example.test'))
  assert.equal(url.search, '')
  assert.equal(url.hash, '')
  assert.ok(url.pathname.includes('%3F'))
  assert.throws(() => productShareUrl('qa', 'javascript:alert(1)'))
  assert.throws(() => productShareUrl('qa', 'https://qa:private@shop.example.test'))
})
test('migas de pan corresponden a las entidades y no inventan una categoría ausente', () => {
  const product = { slug: 'producto-qa', name: 'Producto sintético QA' }
  const category = { slug: 'categoria-qa', name: 'Categoría sintética QA' }
  const full = breadcrumbStructuredData(product, category, 'https://shop.example.test')
  assert.equal(full.itemListElement.length, 3)
  assert.equal(full.itemListElement[1].item, 'https://shop.example.test/categoria/categoria-qa')
  assert.equal(full.itemListElement[2].name, product.name)
  const noCategory = breadcrumbStructuredData(product, null, 'https://shop.example.test')
  assert.equal(noCategory.itemListElement.length, 2)
  assert.deepEqual(noCategory.itemListElement.map(row => row.position), [1, 2])
})
