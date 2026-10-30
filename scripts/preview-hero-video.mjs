import { createStoreReviewsPreview } from './preview-store-reviews.mjs'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const folder = mkdtempSync(join(tmpdir(), 'tecruta-hero-media-'))
const file = join(folder, 'qa-video.mp4')
// Synthetic silent 1080p clip; no commercial file or external provider.
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=24', '-t', '8', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { windowsHide: true })
const bytes = readFileSync(file)
const media = { name: 'qa-hero-video', configureServer(server) { server.middlewares.use((req, res, next) => {
  if (new URL(req.url, 'http://127.0.0.1').pathname !== '/qa-hero-video.mp4') return next()
  res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Length', bytes.length); res.end(bytes)
}) } }
const rt = await createStoreReviewsPreview({ storePort: 5213, panelPort: 5214, plugins: [media] })
const rows = (await rt.db.siteSetting.findUnique({ where: { key: 'homeBanners' } })).value
const videos = [{ ...rows[0], id: 'qa-video', title: 'Video sintético Full HD', description: 'El video dura ocho segundos; la siguiente imagen espera su final.', mediaType: 'video', videoDesktop: '/qa-hero-video.mp4', overlay: 0, buttons: [] }, { ...rows[0], id: 'qa-after', title: 'Imagen siguiente al video', mediaType: 'image', description: 'Se conserva el temporizador para las imágenes.' }]
await rt.db.siteSetting.update({ where: { key: 'homeBanners' }, data: { value: videos } })
await rt.db.siteSetting.update({ where: { key: 'heroCarousel' }, data: { value: { autoplay: true, intervalSeconds: 30 } } })
console.log('Solo QA: http://127.0.0.1:5213/revision-local | panel http://127.0.0.1:5214/banners')
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  if (stopping) return
  stopping = true
  await rt.close(); rmSync(folder, { recursive: true, force: true }); process.exit()
})
