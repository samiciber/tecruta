// Shared by the editor and API; never accepts script/data URLs or iframe pages.
export function validHeroVideoUrl(value) {
  if (!value) return true
  if (typeof value !== 'string' || /\s|\\/.test(value)) return false
  const relative = value.startsWith('/') && !value.startsWith('//')
  try {
    const url = new URL(value, 'https://media.example.test')
    return (relative || value.startsWith('https://') && url.protocol === 'https:') && !url.username && !url.password && /\.(mp4|webm)$/i.test(url.pathname)
  } catch { return false }
}

// A video owns its duration: the image timer must never cut it short.
export function heroAdvanceDelay({ autoplay, paused, video, result, intervalSeconds }) {
  if (!autoplay || paused || video && !result) return null
  if (video && result === 'ended') return 0
  return Math.max(3, Number(intervalSeconds) || 6) * 1000
}
