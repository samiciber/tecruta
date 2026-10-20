import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../services/api.js'
import { useSiteSettings, useBrands } from '../../hooks/useSiteContent.js'
import { STORE_ORIGIN } from '../../app/urls.js'
import { organizationStructuredData, pageMetadata, productStructuredData, safeJsonLd } from '../../utils/seo.js'

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!content) { element?.remove(); return }
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}
export default function StoreSeo() {
  const { pathname } = useLocation()
  const { settings } = useSiteSettings()
  const { all: brands } = useBrands()
  const [state, setState] = useState({ path: '', entity: null, missing: false })
  useEffect(() => {
    const controller = new AbortController()
    const [type, slug] = pathname.split('/').slice(1)
    const load = type === 'producto' ? api.getProductBySlug : type === 'categoria' ? api.getCategoryDetail : null
    if (!load || !slug) return
    let decoded
    try { decoded = decodeURIComponent(slug) }
    catch { setState({ path: pathname, entity: null, missing: true }); return }
    load(decoded, { signal: controller.signal })
      .then(entity => setState({ path: pathname, entity, missing: false }))
      .catch(error => { if (error.name !== 'AbortError') setState({ path: pathname, entity: null, missing: true }) })
    return () => controller.abort()
  }, [pathname])
  const entity = pathname.startsWith('/marca/') ? brands.find(row => '/marca/' + encodeURIComponent(row.slug) === pathname)
    : state.path === pathname ? state.entity : null
  const meta = pageMetadata(pathname, { entity, origin: STORE_ORIGIN, missing: state.path === pathname && state.missing })
  useEffect(() => {
    document.title = meta.title
    setMeta('name', 'description', meta.description)
    setMeta('name', 'robots', meta.noindex ? 'noindex, follow' : 'index, follow')
    setMeta('property', 'og:title', meta.title)
    setMeta('property', 'og:description', meta.description)
    setMeta('property', 'og:url', meta.canonical)
    setMeta('property', 'og:type', meta.type)
    setMeta('property', 'og:image', meta.image)
    setMeta('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary')
    setMeta('name', 'twitter:title', meta.title)
    setMeta('name', 'twitter:description', meta.description)
    setMeta('name', 'twitter:image', meta.image)
    let link = document.head.querySelector('link[rel="canonical"]')
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link) }
    link.href = meta.canonical
  }, [meta.title, meta.description, meta.noindex, meta.canonical, meta.type, meta.image])
  const data = pathname.startsWith('/producto/') && entity ? productStructuredData(entity, STORE_ORIGIN)
    : pathname === '/' ? organizationStructuredData(settings.storeBusiness, STORE_ORIGIN) : null
  return data ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} /> : null
}
