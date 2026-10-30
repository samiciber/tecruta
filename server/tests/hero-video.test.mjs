import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bannerSchema, normalizeHomeBanners } from '../src/lib/navSchemas.js'
import { validateVideo } from '../src/lib/uploadValidation.js'
import { validHeroVideoUrl, heroAdvanceDelay } from '../../src/utils/heroMedia.js'

test('banners existentes conservan imágenes y configuración; videos se normalizan sin perder URLs', () => {
  const old = { id: 'old', title: 'Imagen existente', imageDesktop: 'https://example.test/a.jpg' }
  assert.equal(bannerSchema.parse(old).mediaType, 'image')
  const movie = { id: 'v', mediaType: 'video', videoDesktop: 'https://example.test/a.mp4', videoMobile: 'https://example.test/b.webm', placement: 'hero' }
  assert.equal(normalizeHomeBanners([old, movie])[1].videoMobile, movie.videoMobile)
  assert.equal(bannerSchema.safeParse({ ...movie, placement: 'inline' }).success, false)
  assert.equal(bannerSchema.safeParse({ ...movie, videoDesktop: null }).success, false)
})
test('rechaza scripts, credenciales, iframes, datos y formatos incompatibles', () => {
  for (const url of ['javascript:alert(1)', 'data:video/mp4;base64,AAAA', '//example.test/a.mp4', 'https://u:p@example.test/a.mp4', 'https://youtube.com/watch?v=1', 'http://example.test/a.mp4', 'https://example.test/a.exe']) assert.equal(validHeroVideoUrl(url), false, url)
  for (const url of ['https://example.test/a.mp4?q=1', 'https://example.test/a.webm', '/media/a.mp4']) assert.equal(validHeroVideoUrl(url), true)
})
test('carga de video verifica bytes, tipo MIME y límite, no solo extensión', () => {
  const bytes = Buffer.concat([Buffer.from('000000186674797069736f6d0000020069736f6d6d703432', 'hex')])
  assert.equal(validateVideo('data:video/mp4;base64,' + bytes.toString('base64')).mime, 'video/mp4')
  assert.throws(() => validateVideo('data:video/webm;base64,' + bytes.toString('base64')))
  assert.throws(() => validateVideo('data:video/mp4;base64,' + Buffer.from('<html>fake</html>').toString('base64')))
  assert.throws(() => validateVideo('data:video/mp4;base64,' + 'A'.repeat(28 * 1048576)), /tamaño/)
})
test('el temporizador de imagen espera ended del video y respeta pausa y rotación apagada', () => {
  const base = { autoplay: true, paused: false, video: true, result: null, intervalSeconds: 3 }
  assert.equal(heroAdvanceDelay(base), null)
  assert.equal(heroAdvanceDelay({ ...base, result: 'ended' }), 0)
  assert.equal(heroAdvanceDelay({ ...base, paused: true, result: 'ended' }), null)
  assert.equal(heroAdvanceDelay({ ...base, autoplay: false, result: 'ended' }), null)
  assert.equal(heroAdvanceDelay({ ...base, result: 'failed' }), 3000)
  assert.equal(heroAdvanceDelay({ ...base, video: false }), 3000)
})
