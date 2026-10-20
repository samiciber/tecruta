// No optional import or request when analytics is disabled.
export function trackStoreEvent(name) {
  if (!import.meta.env.VITE_ANALYTICS_DOMAIN) return
  void import('../optional/analytics.js').then(module => module.track(name)).catch(() => {})
}
