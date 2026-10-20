import React from 'react'
import { useSiteSettings } from '../../hooks/useSiteContent.js'

export default function TrustBadges() {
  const { settings } = useSiteSettings()
  const benefits = settings.storeBusiness?.benefits || []
  if (!benefits.length) return null
  return <ul className="flex flex-col gap-2 rounded-xl2 border border-paper-line p-4 text-sm dark:border-night-line sm:flex-row sm:justify-between">
    {benefits.map(label => <li key={label}>{label}</li>)}
  </ul>
}