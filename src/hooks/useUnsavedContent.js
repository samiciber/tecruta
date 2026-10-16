import { useEffect } from 'react'
export function useUnsavedContent(dirty) {
  useEffect(() => {
    if (!dirty) return undefined
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    const click = event => {
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, location.href)
      if (url.pathname === location.pathname && url.search === location.search) return
      if (!window.confirm('Hay cambios sin guardar. ¿Salir y descartarlos?')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true) }
  }, [dirty])
}
