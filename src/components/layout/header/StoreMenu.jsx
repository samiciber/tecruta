import React, { useMemo, useRef, useState } from 'react'
import { Store } from 'lucide-react'
import FloatingPanel from './FloatingPanel.jsx'
import { useStores } from '../../../hooks/useSiteContent.js'

const KEY = 'tecruta:store'
const read = () => {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function useSelectedStore() {
  const { stores } = useStores()
  const [selectedId, setSelectedId] = useState(read)
  const store = useMemo(() => stores.find((s) => s.id === selectedId) ?? stores[0] ?? null, [stores, selectedId])
  const select = (id) => {
    setSelectedId(id)
    try { localStorage.setItem(KEY, id) } catch { /* sin almacenamiento: se usa solo en memoria */ }
  }
  return { stores, store, select }
}

export const storeBlockClass = 'flex items-center gap-2 rounded px-2 py-1 text-left text-white hover:bg-white/10'

export function StoreBlockLabel({ store }) {
  return (
    <>
      <Store className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span className="flex flex-col text-xs leading-tight">
        <span>Tu tienda</span>
        <span className="max-w-[9rem] truncate text-[13px] font-bold">{store?.name ?? 'Tienda online'}</span>
      </span>
    </>
  )
}

export function StoreDetails({ store, stores, onSelect, onClose }) {
  const [choosing, setChoosing] = useState(false)
  if (!store) {
    return <p className="px-5 pb-6 text-sm text-ink-soft dark:text-paper/70">Compras en línea, sin tienda física. Coordinamos envío y recojo por WhatsApp.</p>
  }
  return (
    <div className="px-5 pb-5">
      {!choosing ? (
        <>
          <p className="font-bold text-header dark:text-sky-300">{store.name}</p>
          <p className="mt-2 text-sm leading-snug">
            {store.address1}
            {store.address2 && <><br />{store.address2}</>}
            <br />
            {[store.city, store.postalCode].filter(Boolean).join(' ')}
          </p>
          {store.opensAt && <p className="mt-2 text-sm font-bold">Abre a las {store.opensAt}</p>}
          {stores.length > 1 && (
            <button type="button" onClick={() => setChoosing(true)} className="mt-4 w-full rounded-full border-2 border-header py-2 text-sm font-bold text-header hover:bg-header/5 dark:border-sky-300 dark:text-sky-300">
              Busca otra tienda
            </button>
          )}
        </>
      ) : (
        <ul aria-label="Tiendas disponibles" className="space-y-1">
          {stores.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => { onSelect(s.id); setChoosing(false); onClose() }}
                aria-current={s.id === store.id}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <span className="font-bold">{s.name}</span>
                <span className="block text-xs text-ink-soft dark:text-paper/60">{[s.address1, s.city].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function StoreMenu({ open, onToggle, onClose }) {
  const { stores, store, select } = useSelectedStore()
  const ref = useRef(null)
  return (
    <div className="relative">
      <button ref={ref} type="button" aria-haspopup="true" aria-expanded={open} aria-controls="panel-store" onClick={onToggle} className={storeBlockClass}>
        <StoreBlockLabel store={store} />
      </button>
      {open && (
        <FloatingPanel id="panel-store" title="Tu tienda" width="w-[21rem]" align="right" arrow hideTitle triggerRef={ref} onClose={onClose}>
          <StoreDetails store={store} stores={stores} onSelect={select} onClose={onClose} />
        </FloatingPanel>
      )}
    </div>
  )
}