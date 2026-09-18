import React, { useEffect, useState } from 'react'
import { FileUp, FileText, X, Info } from 'lucide-react'

export default function ReceiptUpload({ file, onChange }) {
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!file || !file.type?.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleSelect = (e) => {
    const selected = e.target.files?.[0]
    if (selected) onChange(selected)
  }

  return (
    <div className="flex flex-col gap-3">
      {!file ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-paper-line px-4 py-8 text-center transition-colors hover:border-route dark:border-night-line">
          <FileUp className="h-6 w-6 text-ink-soft/60 dark:text-paper/40" />
          <span className="text-sm font-medium text-ink dark:text-paper">Adjuntar comprobante de pago</span>
          <span className="text-xs text-ink-soft/60 dark:text-paper/40">Imagen o PDF, opcional en este paso</span>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleSelect} />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-xl2 border border-paper-line p-3 dark:border-night-line">
          {previewUrl ? (
            <img src={previewUrl} alt="Vista previa del comprobante" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-route-soft text-route dark:bg-route-softDark">
              <FileText className="h-6 w-6" />
            </div>
          )}
          <span className="flex-1 truncate text-sm text-ink dark:text-paper">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Quitar comprobante"
            className="rounded-full p-1.5 text-ink-soft/60 hover:bg-signal-red/10 hover:text-signal-red dark:text-paper/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <p className="flex items-start gap-1.5 text-xs text-ink-soft/70 dark:text-paper/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        El comprobante se adjunta solo como referencia local: aún no se envía a ningún servidor. La confirmación final de tu pago se coordina por WhatsApp.
      </p>
    </div>
  )
}
