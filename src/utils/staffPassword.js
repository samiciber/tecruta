export const STAFF_PASSWORD_HELP = 'Usa de 12 a 72 caracteres, con al menos tres tipos: mayúsculas, minúsculas, números y símbolos.'

export function isStrongStaffPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 72 || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) return false
  if (new TextEncoder().encode(value).length > 72) return false
  return [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter(pattern => pattern.test(value)).length >= 3
}

export function generateStaffPassword(random = globalThis.crypto) {
  // 24 characters; rejection sampling avoids modulo bias. Four guaranteed
  // character classes are shuffled along with the random portion.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_'
  const below = max => {
    const limit = 256 - 256 % max
    let byte
    do { byte = random.getRandomValues(new Uint8Array(1))[0] } while (byte >= limit)
    return byte % max
  }
  const chars = ['A', 'a', '7', '!']
  while (chars.length < 24) chars.push(alphabet[below(alphabet.length)])
  for (let i = chars.length - 1; i > 0; i--) { const j = below(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
  return chars.join('')
}
