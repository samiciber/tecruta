import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { filterPanelGroups } from '../../app/panelNavigation.js'

export default function WorkspaceMore({ open, pinned, desktop, query, setQuery, setPinned, close, pathname, follow }) {
  const dialog = useRef(null), search = useRef(null)
  const docked = desktop && pinned, visible = open || docked
  useEffect(() => {
    if (!visible) return
    if (docked) { search.current?.focus(); return }
    const node = dialog.current, overflow = document.body.style.overflow
    node.showModal(); document.body.style.overflow = 'hidden'; search.current?.focus()
    return () => { node.close(); document.body.style.overflow = overflow }
  }, [visible, docked])
  if (!visible) return null
  const groups = filterPanelGroups(query)
  const body = <>
    <div className="workspace-more-heading"><div><h2 id="workspace-more-title" className="text-xl font-bold">Más herramientas</h2><p className="mt-1 text-sm text-ink-soft dark:text-paper/60">Cambia de herramienta sin volver atrás.</p></div><button type="button" onClick={close} aria-label="Cerrar herramientas" className="workspace-more-close"><X size={20} /></button></div>
    <label className="relative block"><span className="sr-only">Buscar en Más</span><Search size={18} aria-hidden="true" className="absolute left-3 top-3.5 text-ink-soft" /><input ref={search} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Usuarios, productos, reportes…" className="input-tr min-h-12 w-full pl-10" /></label>
    {desktop && <label className="my-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />Mantener abierto en escritorio</label>}
    <p role="status" className="sr-only">{groups.reduce((sum, group) => sum + group.items.length, 0)} herramientas disponibles</p>
    <nav aria-label="Herramientas de Más" className="workspace-more-links">{groups.map(group => <section key={group.id} aria-labelledby={'more-' + group.id}><h3 id={'more-' + group.id}>{group.title}</h3>{group.items.map(([to, title, description]) => <Link key={to} to={to} state={{ moreSearch: query ? new URLSearchParams({ buscar: query }).toString() : '' }} aria-current={pathname === to ? 'page' : undefined} onClick={e => { follow(e, to); if (!e.defaultPrevented && !docked && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) close(false) }}><span>{title}</span><small>{description}</small></Link>)}</section>)}</nav>
    {!groups.length && <div className="py-6 text-sm"><p>No encontramos esa herramienta.</p><button type="button" className="mt-3 font-semibold text-route dark:text-blue-300" onClick={() => setQuery('')}>Mostrar todas las herramientas</button></div>}
    <Link to={query ? '/mas?' + new URLSearchParams({ buscar: query }) : '/mas'} onClick={e => { follow(e, '/mas'); if (!e.defaultPrevented && !docked) close(false) }} className="workspace-more-all">Ver página completa de Más</Link>
  </>
  return docked ? <aside aria-labelledby="workspace-more-title" className="workspace-more workspace-more-docked">{body}</aside> : <dialog ref={dialog} aria-labelledby="workspace-more-title" className="workspace-more workspace-more-dialog" onKeyDown={e => {
    if (e.key !== 'Tab') return
    const controls = [...e.currentTarget.querySelectorAll('a[href],button,input')].filter(node => !node.disabled && node.getClientRects().length)
    const first = controls[0], last = controls[controls.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }} onCancel={e => { e.preventDefault(); close() }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); if (e.target === e.currentTarget && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) close() }}>{body}</dialog>
}
