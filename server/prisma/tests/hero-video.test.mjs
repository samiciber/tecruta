import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryRuntime } from './helpers/inventory-runtime.mjs'
let rt, base, calls = 0
before(async () => {
  rt = await createInventoryRuntime({ appOptions: async runtime => {
    const { createAdminRouter } = await import('../../../server/src/routes/admin.routes.js')
    return { admin: createAdminRouter({ uploadVideo: async () => { calls++; return 'https://example.test/uploaded.mp4' } }) }
  } })
  base = await rt.start()
}, { timeout: 180000 })
after(async () => rt?.close())
const request = (path, user, body, method = 'POST') => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + rt.auth(user) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
test('upload solo ADMIN, valida contenido antes de llamar al proveedor', async () => {
  const video = 'data:video/mp4;base64,' + Buffer.from('000000186674797069736f6d0000020069736f6d6d703432', 'hex').toString('base64')
  for (const [user, status] of [[null, 401], [rt.customer, 403], [rt.warehouse, 403], [rt.cashier, 403]]) assert.equal((await request('/api/admin/uploads/video', user, { video })).status, status)
  assert.equal(calls, 0)
  assert.equal((await request('/api/admin/uploads/video', rt.admin, { video: 'fake' })).status, 400)
  const response = await request('/api/admin/uploads/video', rt.admin, { video })
  assert.equal(response.status, 200); assert.equal((await response.json()).url, 'https://example.test/uploaded.mp4'); assert.equal(calls, 1)
})
test('guarda video y lo devuelve en home público y panel desde PostgreSQL', async () => {
  const banner = { id: 'qa-video', title: 'Video sintético', mediaType: 'video', videoDesktop: 'https://example.test/qa.mp4', videoMobile: 'https://example.test/mobile.webm', placement: 'hero' }
  assert.equal((await request('/api/admin/site-settings/homeBanners', rt.admin, [banner], 'PUT')).status, 200)
  const stored = await rt.db.siteSetting.findUnique({ where: { key: 'homeBanners' } })
  assert.equal(stored.value[0].videoDesktop, banner.videoDesktop)
  const publicResponse = await request('/api/site-settings', null, undefined, 'GET')
  assert.equal((await publicResponse.json()).homeBanners[0].videoMobile, banner.videoMobile)
})
