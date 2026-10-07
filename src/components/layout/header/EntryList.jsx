import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { isExternal } from './entries.js'

const rowBase = 'flex w-full items-center justify-between gap-3 px-5 text-left text-[15px] text-ink hover:bg-gray-100 dark:text-paper dark:hover:bg-white/10'

// Lista de entradas (ver entries.js). `onNext(entry)` se llama al pulsar una
// fila con subnivel; `tall` = filas de ~60 px (menú principal).
export default function EntryList({ entries, onNavigate, onNext, tall = false, activeKey = null, label }) {
  const pad = tall ? 'py-[1.1rem]' : 'py-3'
  return (
    <ul aria-label={label} className="pb-3">
      {entries.map((e, i) => {
        if (e.kind === 'divider') return <li key={i} role="separator" className="my-2 h-px bg-gray-200 dark:bg-night-line" />
        if (e.kind === 'heading') {
          return (
            <li key={i} className={`px-5 pb-1 pt-4 text-[15px] font-bold ${i > 0 ? 'mt-2 border-t border-gray-200 dark:border-night-line' : ''}`}>
              {e.label}
            </li>
          )
        }
        if (e.kind === 'next') {
          const active = activeKey === e.label
          return (
            <li key={i}>
              <button type="button" aria-haspopup="true" aria-expanded={active} onClick={() => onNext(e)} className={`${rowBase} ${pad} ${active ? 'bg-gray-100 dark:bg-white/10' : ''}`}>
                <span>{e.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </li>
          )
        }
        return (
          <li key={i}>
            {isExternal(e.to) ? (
              <a href={e.to} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={`${rowBase} ${pad}`}>
                {e.label}
              </a>
            ) : (
              <Link to={e.to} onClick={onNavigate} className={`${rowBase} ${pad}`}>
                {e.label}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}