export function validContentUrl(value, { http = false } = {}) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/.test(value) || value.startsWith('//')) return false
  if (value.startsWith('/')) return true
  try { const url = new URL(value); return (url.protocol === 'https:' || (http && url.protocol === 'http:')) && !url.username && !url.password } catch { return false }
}
