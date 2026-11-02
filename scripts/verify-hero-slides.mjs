// Component markup regression with synthetic data. Not a browser/playback test.
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
}
globalThis.document = { hidden: false }
const server = await createServer({
  envFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  ssr: {
    noExternal: ['react-router-dom', 'react-router', 'lucide-react'],
    resolve: { conditions: ['module-sync', 'module', 'import'] },
  },
})
try {
  const { default: HeroSlider } = await server.ssrLoadModule('/src/components/home/HeroSlider.jsx')
  const render = slides => renderToStaticMarkup(React.createElement(HeroSlider, { slides, carouselConfig: { autoplay: false } }))
  for (const count of [0, 1, 3, 12, 30]) {
    const slides = Array.from({ length: count }, (_, i) => ({ id: 'qa-' + i, title: 'QA ' + i, imageDesktop: `https://example.test/${i}.jpg`, buttons: [] }))
    const html = render(slides)
    assert.equal((html.match(/aria-roledescription="slide"/g) || []).length, count)
    assert.equal((html.match(/<img /g) || []).length, Math.min(count, 3))
    if (count > 7) {
      assert.ok(html.includes('1 / ' + count))
      assert.equal((html.match(/aria-current=/g) || []).length, 0)
    }
    console.log(`OK: ${count} slides, bounded image loading and navigation`)
  }
  const videos = Array.from({ length: 30 }, (_, i) => ({ id: 'movie-' + i, title: 'QA video ' + i, mediaType: 'video', videoDesktop: `https://example.test/${i}.mp4`, buttons: [] }))
  const html = render(videos)
  assert.equal((html.match(/<video/g) || []).length, 3)
  assert.equal((html.match(/src="https:\/\/example.test\/\d+\.mp4"/g) || []).length, 1)
  console.log('OK: 30 video slides, only active video has src')
} finally {
  await server.close()
}
