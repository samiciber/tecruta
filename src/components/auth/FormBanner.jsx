import React from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const TONES = {
  error: {
    Icon: AlertCircle,
    className: 'border-signal-red/30 bg-signal-red/10 text-signal-red',
  },
  success: {
    Icon: CheckCircle2,
    className: 'border-signal-green/30 bg-signal-green/10 text-signal-green',
  },
}

export default function FormBanner({ tone = 'error', children }) {
  if (!children) return null
  const { Icon, className } = TONES[tone] || TONES.error

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${className}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}