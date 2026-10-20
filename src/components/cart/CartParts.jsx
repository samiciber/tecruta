import React, { useRef, useState } from 'react'
import { optimizeImage } from '../../utils/imageUrl.js'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Heart } from 'lucide-react'
import QuantitySelector from '../product/QuantitySelector.jsx'
import { calculateDiscountPercent, formatCurrency } from '../../utils/formatCurrency.js'
import { useCart } from '../../hooks/useCart.js'
import { useSaved } from '../../hooks/useSaved.js'

// Precio grande con centavos en superíndice: S/ 69⁹⁸
export function BigPrice({ value, className = '' }) {
  const [int, cents] = Number(value).toFixed(2).split('.')
  return (
    <span className={`font-bold text-ink dark:text-paper ${className}`} aria-label={formatCurrency(value)}>
      <span aria-hidden="true">
        <span className="align-top text-[11px]">S/ </span>
        <span className="text-xl">{Number(int).toLocaleString('es-PE')}</span>
        <sup className="text-[11px]">{cents}</sup>
      </span>
    </span>
  )
}

const yellowBtn = 'rounded bg-cta px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-cta-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink'

// Tarjeta de producto de los carruseles/guardados (estilo tienda).
export function MiniProductCard({ product, onRemove }) {
  const { addItem, canAdd } = useCart()
  const discount = calculateDiscountPercent(product.price, product.compareAtPrice)
  const out = product.stock <= 0
  return (
    <div className="flex h-full w-48 shrink-0 snap-start flex-col rounded-lg border border-gray-200 p-3 dark:border-night-line sm:w-52">
      <Link to={`/producto/${product.slug}`} className="block aspect-square overflow-hidden rounded bg-white">
        {product.image && <img src={optimizeImage(product.image, 400)} width="400" height="400" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />}
      </Link>
      <Link to={`/producto/${product.slug}`} className="mt-3 line-clamp-3 text-[13px] leading-snug text-ink hover:underline dark:text-paper">
        <strong>{product.brand}</strong> - {product.name}
      </Link>
      <div className="mt-auto pt-2">
        {discount > 0 && <span className="block text-[11px] font-bold text-ink dark:text-paper">Top Deal</span>}
        <BigPrice value={product.price} />
        {product.compareAtPrice > product.price && (
          <span className="block text-xs text-ink-soft line-through dark:text-paper/50">{formatCurrency(product.compareAtPrice)}</span>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          {out ? (
            <Link to={`/producto/${product.slug}`} className="text-xs font-bold text-header hover:underline dark:text-sky-300">Encuentra una tienda</Link>
          ) : (
            <button type="button" disabled={!canAdd(product)} onClick={() => addItem(product, 1)} className={`${yellowBtn} disabled:cursor-not-allowed disabled:opacity-50`}>Añadir al carrito</button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-ink-soft underline hover:text-signal-red dark:text-paper/60">Quitar</button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Card({ title, icon: Icon, children, collapsible = false, id }) {
  const [open, setOpen] = useState(true)
  return (
    <section aria-labelledby={id} className="min-w-0 rounded border border-gray-200 bg-white p-5 dark:border-night-line dark:bg-night-surface sm:p-6">
      <div className="flex items-center justify-between">
        <h2 id={id} className="flex items-center gap-2 text-lg font-bold text-ink dark:text-paper">
          {Icon && <Icon className="h-5 w-5" aria-hidden="true" />} {title}
        </h2>
        {collapsible && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? `Contraer ${title}` : `Expandir ${title}`} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-white/10">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        )}
      </div>
      {(!collapsible || open) && <div className="mt-4 border-t border-gray-200 pt-4 dark:border-night-line">{children}</div>}
    </section>
  )
}

export function SavedItemsCard() {
  const { items, remove } = useSaved()
  return (
    <Card id="saved-title" title="Elementos guardados" icon={Heart} collapsible>
      {items.length === 0 ? (
        <div className="py-2 text-center">
          <p className="text-lg font-bold text-ink dark:text-paper">Tu lista está vacía en este momento</p>
          <p className="mt-2 text-sm text-ink-soft dark:text-paper/70">
            ¿Necesitas inspiración? Consulta <a href="#superventas" className="text-header underline dark:text-sky-300">los artículos recomendados</a> o busca cosas para guardar.
          </p>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 max-w-full gap-3 overflow-x-auto pb-2">
            {items.slice(0, 8).map((p) => <MiniProductCard key={p.id} product={p} onRemove={() => remove(p.id)} />)}
          </div>
          <Link to="/elementos-guardados" className="mt-2 inline-block text-sm font-bold text-header hover:underline dark:text-sky-300">Ver todos ({items.length})</Link>
        </>
      )}
    </Card>
  )
}

export function BestSellersCard({ products }) {
  const ref = useRef(null)
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 440, behavior: 'smooth' })
  if (products.length === 0) return null
  return (
    <div id="superventas" className="min-w-0 scroll-mt-40">
      <Card id="best-title" title="TecRuta superventas">
        <div className="relative min-w-0">
          <div ref={ref} role="region" aria-label="Carrusel de productos superventas" tabIndex={0} className="flex min-w-0 max-w-full snap-x gap-3 overflow-x-auto scroll-smooth pb-2">
            {products.map((p) => <MiniProductCard key={p.id} product={p} />)}
          </div>
          <button type="button" aria-label="Anterior" onClick={() => scroll(-1)} className="absolute -left-3 top-1/3 hidden h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white shadow hover:bg-gray-50 dark:border-night-line dark:bg-night dark:text-paper sm:flex"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Siguiente" onClick={() => scroll(1)} className="absolute -right-3 top-1/3 hidden h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white shadow hover:bg-gray-50 dark:border-night-line dark:bg-night dark:text-paper sm:flex"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </Card>
    </div>
  )
}

// Fila de un artículo en el carrito (página completa).
export function CartPageItem({ item }) {
  const { updateQuantity, removeItem } = useCart()
  const { save } = useSaved()
  const saving = item.compareAtPrice > item.price ? (item.compareAtPrice - item.price) * item.quantity : 0
  return (
    <li className="flex min-w-0 flex-wrap gap-4 py-5 sm:flex-nowrap">
      <Link to={`/producto/${item.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded bg-white">
        {item.image && <img src={optimizeImage(item.image, 192)} width="192" height="192" loading="lazy" decoding="async" alt="" className="h-full w-full object-contain" />}
      </Link>
      <div className="flex min-w-0 flex-1 basis-36 flex-col gap-1 sm:basis-0">
        <Link to={`/producto/${item.slug}`} className="line-clamp-2 text-sm font-medium text-ink hover:underline dark:text-paper"><strong>{item.brand}</strong> - {item.name}</Link>
        <p className="text-xs text-ink-soft dark:text-paper/60">{item.stock <= 5 ? `Solo quedan ${item.stock}` : 'Disponible'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <QuantitySelector quantity={item.quantity} max={item.stock} size="sm" onChange={(q) => updateQuantity(item.id, q)} />
          <button type="button" onClick={() => removeItem(item.id)} className="text-sm text-header underline dark:text-sky-300">Eliminar</button>
          <button type="button" onClick={() => { save(item); removeItem(item.id) }} className="text-sm text-header underline dark:text-sky-300">Guardar para después</button>
        </div>
      </div>
      <div className="ml-auto shrink-0 text-right">
        <BigPrice value={item.price * item.quantity} />
        {saving > 0 && <p className="text-xs font-medium text-signal-green">Ahorras {formatCurrency(saving)}</p>}
      </div>
    </li>
  )
}
