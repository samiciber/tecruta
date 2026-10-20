import React from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Music2, Facebook, Youtube, Linkedin, Mail, MessageCircle } from 'lucide-react'
import { api } from '../../services/api.js'
import { useCachedResource } from '../../hooks/useCachedResource.js'
import NewsletterForm from './NewsletterForm.jsx'
import {BusinessDetails} from './ShopInformation.jsx'
const icons = { instagram: Instagram, tiktok: Music2, facebook: Facebook, youtube: Youtube, linkedin: Linkedin }
const linkClass = 'rounded-sm text-sm text-ink-soft hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route dark:text-paper/80 dark:focus-visible:ring-sky-300'
function FooterLink({ href, children }) { return href.startsWith('/') ? <Link className={linkClass} to={href}>{children}</Link> : <a className={linkClass} href={href} target="_blank" rel="noopener noreferrer">{children}</a> }
export default function FooterContent() {
  const { data, loading, error, refresh } = useCachedResource('footer', api.getFooter, { fallback: null })
  if (!data) return <footer className="border-t border-paper-line p-6 text-center text-sm dark:border-night-line">{loading ? 'Cargando información del sitio…' : <p role="status">No pudimos cargar la información del sitio. <button className="underline" onClick={refresh}>Reintentar</button></p>}</footer>
  return <footer className="storefront-footer break-words border-t border-paper-line bg-paper-surface text-ink dark:border-night-line dark:bg-night-surface dark:text-paper">
    <BusinessDetails/>
    <div className="container-tr py-10">
      {error && <p role="status" className="mb-4 text-sm">No se pudo actualizar la información; mostramos la última versión disponible. <button onClick={refresh} className="underline">Reintentar</button></p>}
      <div className={`grid gap-8 ${data.newsletter.enabled ? 'lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]' : ''}`}>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          <div className="col-span-2 md:col-span-3"><p className="font-display text-xl font-bold">{data.brand}</p><p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft dark:text-paper/75">{data.description}</p></div>
          {data.groups.map(group => <nav key={group.id} aria-label={group.title}><h2 className="mb-3 font-semibold">{group.title}</h2><ul className="space-y-2">{group.links.map(link => <li key={link.id}><FooterLink href={link.href}>{link.label}</FooterLink></li>)}</ul></nav>)}
          <section aria-label={data.contactTitle} className="min-w-0"><h2 className="mb-3 font-semibold">{data.contactTitle}</h2><ul className="space-y-2 text-sm text-ink-soft dark:text-paper/75">{data.contactLines.map((line, i) => <li key={i}>{line}</li>)}
            {data.email && <li><a className={`${linkClass} inline-flex max-w-full items-center gap-2 break-all`} href={`mailto:${data.email}`}><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{data.email}</a></li>}
            {data.whatsapp && <li><a className={linkClass} href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />WhatsApp</a></li>}
          </ul></section>
        </div>
        {data.newsletter.enabled && <NewsletterForm content={data.newsletter} />}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-paper-line pt-5 dark:border-night-line">
        <p className="text-sm text-ink-soft dark:text-paper/75">© {new Date().getFullYear()} {data.copyright}</p>
        <nav aria-label="Información legal" className="flex flex-wrap gap-4">{data.legalLinks.map(link => <Link key={link.id} className={linkClass} to={`/legal/${link.type}`}>{link.label}</Link>)}</nav>
        <ul aria-label="Redes sociales" className="flex flex-wrap gap-3">{data.socials.map(social => { const Icon = icons[social.platform]; return <li key={social.id}><a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} className="flex h-10 w-10 items-center justify-center rounded-full border border-paper-line focus-visible:ring-2 focus-visible:ring-route dark:border-night-line dark:focus-visible:ring-sky-300"><Icon className="h-5 w-5" aria-hidden="true" /></a></li> })}</ul>
      </div>
    </div>
  </footer>
}
