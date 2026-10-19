import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'

// Non-authoritative UI preferences only. Failure never blocks business records.
export function useWorkspacePreference(name, initial, valid = value => typeof value === typeof initial) {
  const { user } = useAuth(), key = `tecruta:workspace:${user.id}:${name}`
  const [value, setValue] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(key)); return valid(saved) ? saved : initial } catch { return initial } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* preference storage is optional */ } }, [key, value])
  return [value, setValue]
}
export function useWorkspaceScroll(ready = true) {
  const { user } = useAuth(), location = useLocation(), restored = useRef('')
  const key = `tecruta:scroll:${user.id}:${location.pathname}${location.search}`
  useLayoutEffect(() => {
    if (!ready || restored.current === key) return
    restored.current = key
    try { const y = Number(sessionStorage.getItem(key)); if (Number.isFinite(y) && y >= 0) window.scrollTo(0, y) } catch { /* optional */ }
  }, [key, ready])
  useEffect(() => {
    if (!ready) return
    let timer, last = window.scrollY
    const save = () => { try { sessionStorage.setItem(key, String(last)) } catch { /* optional */ } }
    const scrolled = () => { last = window.scrollY; clearTimeout(timer); timer = setTimeout(save, 150) }
    window.addEventListener('scroll', scrolled, { passive: true })
    window.addEventListener('pagehide', save)
    return () => { clearTimeout(timer); save(); window.removeEventListener('scroll', scrolled); window.removeEventListener('pagehide', save) }
  }, [key, ready])
}
