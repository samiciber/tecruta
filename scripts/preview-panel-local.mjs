import { createPanelPreview } from './lib/panel-preview-runtime.mjs'
const rt = await createPanelPreview()
let stopping = false
async function stop() { if (stopping) return; stopping = true; await rt.close(); process.exit() }
process.once('SIGINT', stop); process.once('SIGTERM', stop)
console.log(`REVISIÓN LOCAL: ${rt.panel}/revision-local`)
console.log(`Panel: ${rt.panel}/iniciar-sesion | Tienda: ${rt.shop}`)
console.log('Base local desechable; correos interceptados; no se utiliza producción. Ctrl+C para cerrar.')
