import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useCachedResource } from '../hooks/useCachedResource.js'
import { api } from '../services/api.js'
export default function ManagedLegal() {
  const { type } = useParams()
  const { data, loading, error, refresh } = useCachedResource(`legal-${type}`, () => api.getLegal(type), { fallback: null })
  if (!['terminos', 'privacidad'].includes(type)) return <Navigate to="/" replace />
  return <article className="container-tr max-w-3xl py-12">
    {loading && !data && <p role="status">Cargando documento…</p>}
    {error && <p role="alert" className="mb-5 text-sm">No se pudo cargar la última versión. <button className="underline" onClick={refresh}>Reintentar</button></p>}
    {data && <><h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-paper">{data.title}</h1><div className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft dark:text-paper/80">{data.body}</div></>}
  </article>
}
