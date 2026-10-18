import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { panelGroups } from '../../app/panelNavigation.js'
const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export default function AdminMore() {
  const [query, setQuery] = useState('')
  const groups = panelGroups.map(group => ({ ...group, items: group.items.filter(item => normalized(group.title + ' ' + item.join(' ')).includes(normalized(query.trim()))) })).filter(group => group.items.length)
  return <section>
    <div className="workspace-section-heading"><div><p className="workspace-eyebrow">Herramientas del administrador</p><h1 className="text-3xl font-bold">Más herramientas</h1><p className="mt-2 text-sm text-ink-soft dark:text-paper/60">Personal, catálogo y edición de la tienda, cada uno en su lugar.</p></div><label className="relative block w-full sm:w-80"><span className="sr-only">Buscar herramienta</span><Search size={18} className="absolute left-3 top-3.5 text-ink-soft" aria-hidden="true" /><input type="search" value={query} onChange={e => setQuery(e.target.value)} className="input-tr min-h-12 w-full pl-10" placeholder="Ej.: usuarios, banners, reportes…" /></label></div>
    <p role="status" className="sr-only">{groups.reduce((sum, group) => sum + group.items.length, 0)} herramientas disponibles</p>
    <div className="space-y-8">{groups.map(group => <section key={group.id} aria-labelledby={`group-${group.id}`}><h2 id={`group-${group.id}`} className="text-lg font-bold">{group.title}</h2><p className="mb-4 mt-1 text-sm text-ink-soft dark:text-paper/60">{group.description}</p><div className="workspace-hub-grid">{group.items.map(([to, title, description]) => <Link key={to} to={to} className="workspace-action items-start"><div className="min-w-0 flex-1"><span className="font-semibold">{title}</span><small>{description}</small></div><ArrowUpRight size={18} className="shrink-0 text-route dark:text-blue-300" aria-hidden="true" /></Link>)}</div></section>)}</div>
    {!groups.length && <div className="rounded-2xl border border-dashed border-paper-line p-8 text-center dark:border-night-line"><p>No encontramos una herramienta con ese nombre.</p><button className="mt-3 font-semibold text-route" onClick={() => setQuery('')}>Ver todas las herramientas</button></div>}
  </section>
}
