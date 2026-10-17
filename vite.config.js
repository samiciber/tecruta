import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const panel = mode === 'panel'
  return {
    plugins: [react(), {
      name: 'tecruta-application-html',
      transformIndexHtml(html) {
        if (!panel) return html
        return html.replace(/<title>.*?<\/title>/, '<title>Panel TecRuta</title>')
          .replace('</head>', '<meta name="robots" content="noindex, nofollow, noarchive" /></head>')
      },
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue
          for (const module of Object.keys(output.modules)) {
            const path = module.replaceAll('\\', '/')
            if (!panel && /\/src\/pages\/(admin|panel|pos)\//.test(path)) this.error('La tienda está incluyendo una pantalla del panel.')
            if (panel && /\/src\/pages\/(Home|Catalog|ProductDetail|Checkout|Cart|Login|Register|GoogleCallback)\.jsx$/.test(path)) this.error(`El panel está incluyendo una página comercial: ${path.split('/src/')[1]}`)
          }
        }
      },
      closeBundle() {
        if (panel) writeFileSync(resolve('dist-panel/robots.txt'), 'User-agent: *\nDisallow: /\n')
      },
    }],
    cacheDir: panel ? 'node_modules/.vite-panel' : 'node_modules/.vite-store',
    resolve: { alias: { '@tecruta/application': fileURLToPath(new URL(panel ? './src/app/PanelRoot.jsx' : './src/app/StoreRoot.jsx', import.meta.url)) } },
    build: { outDir: panel ? 'dist-panel' : 'dist', manifest: true },
    server: { host: '127.0.0.1', port: panel ? 5180 : 5173 },
  }
})
