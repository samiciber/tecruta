import React, { useMemo, useState } from 'react'
import FloatingPanel from './FloatingPanel.jsx'
import EntryList from './EntryList.jsx'
import SubPanel from './SubPanel.jsx'
import { navToEntries } from './entries.js'

// Panel de Acuerdos / Soporte y Servicios / Descubre / Más. Los ítems con
// subnivel (SUBMENU) abren su propio flotante al costado.
export default function NavPanel({ id, title, items, width, align, triggerRef, onClose }) {
  const entries = useMemo(() => navToEntries(items), [items])
  const [sub, setSub] = useState(null)

  return (
    <FloatingPanel
      id={id}
      title={title}
      width={width}
      align={align}
      triggerRef={triggerRef}
      onClose={onClose}
      side={sub && <SubPanel node={sub} onClose={() => setSub(null)} onNavigate={onClose} />}
    >
      {entries.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-ink-soft dark:text-paper/60">Pronto habrá contenido aquí.</p>
      ) : (
        <EntryList entries={entries} onNavigate={onClose} onNext={(e) => setSub(e.next)} activeKey={sub?.title} label={title} />
      )}
    </FloatingPanel>
  )
}