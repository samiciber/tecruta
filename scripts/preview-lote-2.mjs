import { createStoreReviewsPreview } from './preview-store-reviews.mjs'
for (const key of ['ORDER_EMAILS_ENABLED', 'ERROR_MONITOR_DSN', 'FRONTEND_ERROR_MONITOR_DSN', 'VITE_ERROR_MONITOR_DSN', 'VITE_ANALYTICS_DOMAIN', 'PLAUSIBLE_DOMAIN', 'PLAUSIBLE_ENDPOINT']) delete process.env[key]
const runtime = await createStoreReviewsPreview({ storePort: 5203, panelPort: 5204 })
await runtime.db.product.update({ where: { id: runtime.products[0].id }, data: {
  specifications: [{ label: 'Escenario', value: 'Producto sintético QA' }, { label: 'Uso', value: 'Validación local' }],
  images: { create: [{ url: runtime.shop + '/fixtures/zoom-1.svg', position: 0 }, { url: runtime.shop + '/fixtures/zoom-2.svg', position: 1 }] },
} })
console.log('Revisión local: ' + runtime.shop + '/revision-local')
let closing = false
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => {
  if (closing) return
  closing = true
  await runtime.close()
  process.exit()
})
