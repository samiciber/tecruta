import React, { useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { Field, Check } from './adminUi.jsx'
export default function ManualProductSource({ source, onChange }) {
  const { token } = useAuth()
  const [query, setQuery] = useState(''), [items, setItems] = useState([]), [error, setError] = useState('')
  const [names, setNames] = useState({})
  const ids = source.productIds || []
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      try { const result = await api.admin.searchHomeProducts(query.length >= 2 ? { q: query } : { ids: ids.join(',') }, token); if (active) { setItems(result); setNames(previous => ({ ...previous, ...Object.fromEntries(result.map(item => [item.id, item.name])) })); setError('') } } catch (err) { if (active) setError(err.message) }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query, ids.join(','), token])
  return <fieldset className="space-y-3 sm:col-span-2"><legend>Selección manual (máximo 20, en orden de selección)</legend><Field label="Buscar productos para la selección"><input className="input-tr" value={query} onChange={e => setQuery(e.target.value)} /></Field>{error && <p role="alert">{error}</p>}
    {items.map(item => <Check key={item.id} label={item.name} checked={ids.includes(item.id)} onChange={selected => onChange({ ...source, productIds: selected ? [...ids, item.id].slice(0, 20) : ids.filter(id => id !== item.id) })} />)}
    <ol className="space-y-2">{ids.map((id, index) => <li key={id} className="flex flex-wrap items-center gap-3 text-sm"><span>{index + 1}. {names[id] || id}</span><button type="button" className="underline" disabled={index === 0} onClick={() => { const next = [...ids]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange({ ...source, productIds: next }) }}>Subir producto</button><button type="button" className="underline" onClick={() => onChange({ ...source, productIds: ids.filter(value => value !== id) })}>Quitar producto</button></li>)}</ol>
  </fieldset>
}
