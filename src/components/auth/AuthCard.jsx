import React from 'react'
import { Link } from 'react-router-dom'
import { storeConfig } from '../../config/storeConfig.js'

export default function AuthCard({ title, subtitle, children, footer, maxWidthClass = 'max-w-md' }) {
  return (
    <div className="container-tr flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 sm:py-16">
      <div className={`w-full ${maxWidthClass} card-surface animate-fade-up p-6 sm:p-8`}>
        <Link to="/" className="mb-6 inline-flex items-center gap-2" aria-label={`${storeConfig.name} — inicio`}>
          <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <rect width="30" height="30" rx="8" className="fill-route" />
            <path d="M7 19 L13 11 L17 16 L23 8" stroke="white" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="23" cy="8" r="1.8" fill="white" />
          </svg>
          <span className="font-display text-base font-bold tracking-tight text-ink dark:text-paper">
            Tec<span className="text-route">Ruta</span>
          </span>
        </Link>

        <div className="mb-6 flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold text-ink dark:text-paper sm:text-[1.75rem]">{title}</h1>
          {subtitle && <p className="text-sm text-ink-soft dark:text-paper/60">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="mt-6 border-t border-paper-line pt-5 dark:border-night-line">{footer}</div>}
      </div>
    </div>
  )
}