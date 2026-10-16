import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Package, Headphones, MapPin, Heart, Monitor, CircleHelp, FileText, Truck, ArrowLeftRight, CircleDollarSign } from 'lucide-react'
import HeroSlide from './HeroSlide.jsx'
import { ProductCarousel } from './ProductCarousel.jsx'
import { optimizeImage, imageSrcSet } from '../../utils/imageUrl.js'

function ContentImage({ item, className, fallbackAlt = '' }) {
  return <picture>{item.imageMobile && <source media="(max-width: 767px)" srcSet={imageSrcSet(item.imageMobile, [480, 768]) || item.imageMobile} />}<img src={optimizeImage(item.image, 1280)} srcSet={imageSrcSet(item.image, [480, 768, 1280])} sizes="(max-width: 767px) 100vw, 50vw" alt={item.imageAlt || fallbackAlt} loading="lazy" decoding="async" className={className} /></picture>
}

const surface = 'rounded-xl2 border border-paper-line bg-paper-surface dark:border-night-line dark:bg-night-surface'
const heading = 'break-words font-display text-2xl font-bold text-ink dark:text-paper'
const linkStyle = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-night'
export const BENEFIT_ICONS = { info: Info, package: Package, headphones: Headphones, mapPin: MapPin, heart: Heart, monitor: Monitor, helpCircle: CircleHelp, fileText: FileText }
const supportIcons = [CircleHelp, Package, Truck, ArrowLeftRight, CircleDollarSign]

function ContentLink({ href, children, className = '' }) {
  return /^https?:\/\//.test(href)
    ? <a href={href} className={`${linkStyle} ${className}`} target="_blank" rel="noopener noreferrer">{children}</a>
    : <Link to={href} className={`${linkStyle} ${className}`}>{children}</Link>
}

function AccessGrid({ items }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
    {items.map(item => <ContentLink key={item.id} href={item.href} className="min-w-0 rounded-xl p-2 text-center text-sm font-medium text-ink hover:bg-route-soft dark:text-paper dark:hover:bg-route-softDark">
      {item.image && <ContentImage item={item} className="mx-auto mb-3 aspect-square w-full max-w-28 rounded-full bg-paper object-contain p-3 dark:bg-white/5" />}
      <span className="block break-words">{item.title}</span>
      {item.description && <span className="mt-2 block break-words text-xs font-normal text-ink-soft dark:text-paper/70">{item.description}</span>}
    </ContentLink>)}
  </div>
}

function Section({ section, children }) {
  return <section className="container-tr py-6 sm:py-8" aria-label={section.title || SECTION_LABELS[section.type]}>
    {children}
  </section>
}

export const SECTION_LABELS = {
  splitRow: 'Fila dividida', editorialTiles: 'Tiles editoriales', brands: 'Comprar por marca', benefits: 'Beneficios',
  supportLinks: 'Accesos de soporte', legalText: 'Texto legal', useSelections: 'Selecciones por espacio o uso',
}

function SplitRow({ section }) {
  const { banner, panel } = section
  const columns = !banner || !panel ? '' : section.ratio === '50/50' ? 'lg:grid-cols-2'
    : section.reverse ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
  const editorial = banner && <div key="banner" className="min-w-0 overflow-hidden rounded-xl2"><HeroSlide slide={banner} size="banner" className="h-full" /></div>
  const content = panel && <div key="panel" className="min-w-0">
    {panel.kind === 'products'
      ? <ProductCarousel embedded id={section.id} title={section.title || panel.source.label} tabs={[{ ...panel.source, products: panel.products }]} />
      : <div className={`${surface} h-full p-5 sm:p-6`}>
        <h2 className={`${heading} mb-5`}>{section.title || 'Explora categorías'}</h2>
        <AccessGrid items={panel.items} />
      </div>}
  </div>
  return <Section section={section}><div className={`grid items-stretch gap-4 ${columns}`}>{section.reverse ? [content, editorial] : [editorial, content]}</div></Section>
}

function EditorialTiles({ section }) {
  return <Section section={section}><div className={`${surface} p-4 sm:p-6`}>
    {section.title && <h2 className={`${heading} mb-5`}>{section.title}</h2>}
    <div className={`grid grid-cols-2 gap-4 ${section.columns === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
      {section.items.map(item => <ContentLink key={item.id} href={item.href} className="flex h-full min-w-0 flex-col rounded-xl text-ink dark:text-paper">
        <ContentImage item={item} className="aspect-[4/3] w-full rounded-xl bg-paper object-cover dark:bg-night" />
        <h3 className="mt-3 break-words font-display text-base font-semibold">{item.title}</h3>
        {item.description && <p className="mt-2 break-words text-sm text-ink-soft dark:text-paper/70">{item.description}</p>}
      </ContentLink>)}
    </div>
  </div></Section>
}

function BrandItem({ item }) {
  const [failed, setFailed] = useState(false)
  return <ContentLink href={item.href} className={`${surface} flex min-h-28 min-w-0 flex-col items-center justify-center gap-3 p-4 text-center font-semibold text-ink dark:text-paper`}>
    {item.image && !failed && <img src={item.image} alt="" loading="lazy" onError={() => setFailed(true)} className="h-12 max-w-full rounded bg-white object-contain p-1" />}
    <span className="break-words">{item.title}</span>
  </ContentLink>
}

function UseSelections({ section }) {
  const [selected, setSelected] = useState(null)
  const refs = useRef([])
  const active = Math.max(0, section.tabs.findIndex(tab => tab.id === selected))
  const tab = section.tabs[active]
  const prefix = `home-use-${section.id}`
  const onKeyDown = event => {
    const keys = { ArrowRight: (active + 1) % section.tabs.length, ArrowLeft: (active + section.tabs.length - 1) % section.tabs.length, Home: 0, End: section.tabs.length - 1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const index = keys[event.key]
    setSelected(section.tabs[index].id)
    refs.current[index]?.focus()
  }
  return <Section section={section}><div className={`${surface} p-4 sm:p-6`}>
    <h2 className={`${heading} mb-4`}>{section.title || 'Por espacio o uso'}</h2>
    <div role="tablist" aria-label={section.title || 'Espacios y usos'} className="mb-5 flex gap-2 overflow-x-auto pb-2">
      {section.tabs.map((item, index) => <button key={item.id} ref={element => { refs.current[index] = element }} type="button" role="tab"
        id={`${prefix}-tab-${item.id}`} aria-controls={`${prefix}-panel`} aria-selected={index === active} tabIndex={index === active ? 0 : -1}
        onClick={() => setSelected(item.id)} onKeyDown={onKeyDown}
        className={`${linkStyle} shrink-0 rounded-full border px-4 py-2 text-sm ${index === active ? 'border-route bg-route-soft text-route dark:bg-route-softDark dark:text-sky-300' : 'border-paper-line text-ink dark:border-night-line dark:text-paper'}`}>{item.label}</button>)}
    </div>
    <div id={`${prefix}-panel`} role="tabpanel" aria-labelledby={`${prefix}-tab-${tab.id}`} tabIndex={0} className={`${linkStyle} grid gap-6 rounded-lg md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`}>
      <ContentImage item={tab} fallbackAlt={tab.label} className="aspect-[4/3] w-full rounded-xl object-cover" />
      <div className="min-w-0 self-center"><AccessGrid items={tab.links} /></div>
    </div>
  </div></Section>
}

export default function HomeContentSection({ section }) {
  if (section.type === 'splitRow') return <SplitRow section={section} />
  if (section.type === 'editorialTiles') return <EditorialTiles section={section} />
  if (section.type === 'useSelections') return <UseSelections section={section} />
  if (section.type === 'brands') return <Section section={section}>
    <h2 className={`${heading} mb-5`}>{section.title || 'Comprar por marca'}</h2>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{section.items.map(item => <BrandItem key={`${item.id}-${item.image}`} item={item} />)}</div>
  </Section>
  if (section.type === 'benefits') return <Section section={section}><div className={`${surface} p-5 sm:p-6`}>
    {section.title && <h2 className={`${heading} mb-5`}>{section.title}</h2>}
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[repeat(var(--benefit-count),minmax(0,1fr))]" style={{ '--benefit-count': section.items.length }}>
      {section.items.map(item => { const Icon = BENEFIT_ICONS[item.icon]; return <li key={item.id} className="min-w-0 break-words">
        <Icon aria-hidden="true" className="mb-3 h-7 w-7 text-route dark:text-sky-300" />
        <h3 className="font-semibold text-ink dark:text-paper">{item.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-ink-soft dark:text-paper/70">{item.text}</p>
      </li> })}
    </ul>
  </div></Section>
  if (section.type === 'supportLinks') return <Section section={section}>
    {section.title && <h2 className={`${heading} mb-5`}>{section.title}</h2>}
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">{section.items.map((item, index) => { const Icon = supportIcons[index]; return <li key={index} className="min-w-0">
      <ContentLink href={item.href} className="flex h-full flex-col items-center gap-3 rounded-lg p-3 text-center text-sm font-semibold text-route dark:text-sky-300"><Icon aria-hidden="true" className="h-8 w-8" /><span className="break-words">{item.label}</span></ContentLink>
    </li> })}</ul>
  </Section>
  if (section.type === 'legalText') return <Section section={section}><div className={`${surface} p-5 sm:p-6`}>
    {section.title && <h2 className="mb-3 font-display text-lg font-semibold text-ink dark:text-paper">{section.title}</h2>}
    <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft dark:text-paper/80">{section.text}</p>
  </div></Section>
  return null
}
