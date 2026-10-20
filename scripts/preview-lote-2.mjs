import { createStoreReviewsPreview } from './preview-store-reviews.mjs'
for (const key of ['ORDER_EMAILS_ENABLED', 'ERROR_MONITOR_DSN', 'VITE_ERROR_MONITOR_DSN', 'VITE_ANALYTICS_ENDPOINT', 'VITE_ANALYTICS_DOMAIN']) delete process.env[key]
const runtime = await createStoreReviewsPreview({ storePort: 5203, panelPort: 5204 })
console.log('Revisión local: ' + runtime.shop + '/revision-local')
let closing = false
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, async () => {
  if (closing) return
  closing = true
  await runtime.close()
  process.exit()
})
