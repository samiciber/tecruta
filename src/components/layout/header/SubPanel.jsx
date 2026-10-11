import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import EntryList from './EntryList.jsx'

// Flotante de subnivel que se abre al costado de su padre (2.º y 3.er nivel
// del Menú, o el subnivel de Descubre). Recursivo: una fila con subnivel
// abre otro SubPanel a su derecha. Se renderiza FUERA del área con scroll
// del padre (prop `side` de FloatingPanel / dentro de otro SubPanel).
// IMPORTANTE: quien lo renderiza debe pasarle `key={node.title}`; si no, al pasar de una
// fila a otra se conservaría el submenú anidado de la fila anterior.
export default function SubPanel({ node, onClose, onNavigate }) {
  const [next, setNext] = useState(null)
  const ref = useRef(null)

  // Al abrir, el foco pasa al primer elemento del subnivel.
  useEffect(() => {
    ref.current?.querySelector('a[href],button')?.focus()
  }, [node])

  return (
    <div ref={ref} role="group" aria-label={node.title} className="absolute left-full top-0 z-10 ml-2 w-[18rem] rounded-lg bg-white text-ink shadow-2xl dark:bg-night-surface dark:text-paper">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h3 className="pr-2 font-body text-lg font-bold leading-snug">{node.title}</h3>
        <button type="button" onClick={onClose} aria-label={`Cerrar ${node.title}`} className="shrink-0 rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto overscroll-contain">
        {node.empty || node.entries.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-ink-soft dark:text-paper/60">Próximamente.</p>
        ) : (
          <EntryList entries={node.entries} onNavigate={onNavigate} onNext={(e) => setNext(e.next)} activeKey={next?.title} label={node.title} />
        )}
      </div>
      {next && <SubPanel key={next.title} node={next} onClose={() => setNext(null)} onNavigate={onNavigate} />}
    </div>
  )
}