import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useCachedResource } from '../hooks/useCachedResource.js'
import { optimizeImage } from '../utils/imageUrl.js'
export default function CategoryDirectory() {
  const { data, loading, error, refresh } = useCachedResource('category-tree', api.getCategoryTree, { fallback: [] })
  return <section className="container-tr py-8">
    <h1 className="mb-6 font-display text-2xl font-bold">Categorías</h1>
    {loading && <p role="status">Cargando categorías…</p>}
    {error && <p role="alert">No se pudieron cargar las categorías. <button className="underline" onClick={refresh}>Reintentar</button></p>}
    {!loading && !error && !data.length && <p>No hay categorías publicadas.</p>}
    <ul className="store-category-directory">{data.map(row => <li key={row.slug}><Link to={'/categoria/' + encodeURIComponent(row.slug)}>
      {row.image && <img src={optimizeImage(row.image, 400)} width="400" height="300" loading="lazy" decoding="async" alt=""/>}
      <strong>{row.name}</strong>
    </Link></li>)}</ul>
  </section>
}
