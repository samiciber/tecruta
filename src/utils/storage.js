// Envoltorio seguro sobre localStorage: nunca asume que el contenido
// almacenado es válido, y nunca deja que un error de lectura/escritura
// rompa la aplicación.

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
