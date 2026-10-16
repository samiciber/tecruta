// Framework-independent shared cache. Only successful API data is purchasable.
const resources = new Map()
export function invalidatedResourcesFor(method, path) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return []
  const keys = []
  if (/^\/api\/admin\/(products|brands|categories|category-tree)(\/|$)/.test(path) || path === '/api/orders' || /^\/api\/admin\/orders\/[^/]+\/status$/.test(path)) {
    keys.push('products', 'home')
  }
  if (/^\/api\/admin\/payment-methods(\/|$)/.test(path)) keys.push('payment-methods')
  if (/^\/api\/admin\/site-settings\/(homeLayout|homeBanners|homeCircles|heroCarousel|cartFooterLinks)$/.test(path)) keys.push('site-settings', 'home')
  if (path === '/api/admin/home-layout') keys.push('home')
  if (/^\/api\/admin\/site-settings\/(footerContent|cartFooterLinks)$/.test(path)) keys.push('footer')
  if (path === '/api/admin/site-settings/legalPages') keys.push('legal')
  if (path === '/api/admin/footer-content') keys.push('footer', 'legal', 'site-settings')
  return keys
}
export function invalidateLiveResources(prefix) {
  for (const [key, resource] of resources) if (key.startsWith(prefix)) resource.invalidate()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tecruta:resource-invalidated', { detail: prefix }))
  }
}
export function createLiveResource({ key, fetcher, fallback, ttl = 60_000, retry = 15_000, timeout = 10_000, now = Date.now }) {
  let state = { data: [], source: 'none', loading: true, refreshing: false, error: null, checkedAt: 0, stale: true, version: 0 }
  let pending = null, generation = 0, timer = null
  const listeners = new Set()
  const publish = patch => { state = { ...state, ...patch }; for (const listener of listeners) listener() }
  const isFresh = () => state.source === 'api' && !state.stale && !state.error && now() - state.checkedAt < ttl
  async function bounded(run) {
    const controller = new AbortController()
    let deadline
    try {
      return await Promise.race([
        Promise.resolve().then(() => run(controller.signal)),
        new Promise((_, reject) => { deadline = setTimeout(() => { controller.abort(); reject(new Error('La actualización tardó demasiado.')) }, timeout) }),
      ])
    } finally { clearTimeout(deadline) }
  }
  function arm() {
    clearTimeout(timer)
    if (!listeners.size) return
    const delay = state.error ? retry : Math.max(1, ttl - (now() - state.checkedAt))
    timer = setTimeout(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void load(); else armHidden() }, delay)
  }
  function armHidden() { timer = setTimeout(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void load(); else armHidden() }, retry) }
  async function load(force = false) {
    if (pending) return pending
    if (!force && isFresh()) { arm(); return state }
    const started = generation
    const stale = state.stale || !isFresh()
    pending = bounded(fetcher).then(data => {
      if (started === generation) publish({ data, source: 'api', loading: false, error: null, checkedAt: now(), stale: false, version: state.version + 1 })
    }).catch(async error => {
      if (started !== generation) return
      let data = state.data, source = state.source
      if (source === 'none') {
        try { data = fallback ? await bounded(fallback) : []; source = fallback ? 'fallback' : 'none' } catch { data = []; source = 'none' }
      }
      if (started === generation) publish({ data, source, loading: false, error, stale: true })
    }).then(() => {
      pending = null
      if (started !== generation) return load(true)
      publish({ refreshing: false }); arm(); return state
    })
    publish({ refreshing: true, stale })
    return pending
  }
  const visible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void load(true) }
  const resource = {
    getSnapshot: () => state,
    isFresh,
    load,
    async fresh() {
      await load(true)
      if (!isFresh()) throw new Error('No pudimos actualizar la información para comprar. Reintenta.')
      return state.data
    },
    invalidate() { generation++; publish({ stale: true }); if (listeners.size) void load(true) },
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        if (typeof window !== 'undefined') window.addEventListener('focus', visible)
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible)
        void load()
      }
      return () => {
        listeners.delete(listener)
        if (!listeners.size) {
          clearTimeout(timer)
          if (typeof window !== 'undefined') window.removeEventListener('focus', visible)
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible)
        }
      }
    },
  }
  resources.set(key, resource)
  return resource
}
