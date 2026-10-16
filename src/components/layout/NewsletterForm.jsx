import React, { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api.js'
export default function NewsletterForm({ content }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault(); setState('sending'); setError('')
    try { await api.subscribe({ email, consent }); setState('success'); setEmail(''); setConsent(false) }
    catch (err) { setState('error'); setError(err.message) }
  }
  return <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-xl2 border border-paper-line bg-paper p-5 dark:border-night-line dark:bg-night">
    <h2 id={`${id}-title`} className="font-display text-lg font-bold">{content.title}</h2>
    <p className="mt-2 text-sm text-ink-soft dark:text-paper/75">{content.description}</p>
    <form onSubmit={submit} className="mt-4 space-y-3" aria-busy={state === 'sending'}>
      <label className="block text-sm" htmlFor={`${id}-email`}>{content.label}</label>
      <div className="flex flex-wrap gap-2"><input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder={content.placeholder} className="input-tr min-w-0 flex-1 basis-40 dark:placeholder:text-paper/60" /><button type="submit" disabled={state === 'sending' || !consent} className="btn-primary px-4 py-2 disabled:opacity-50">{state === 'sending' ? 'Enviando…' : content.button}</button></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" /><span>{content.consent} <Link to="/legal/privacidad" className="underline">Privacidad</Link></span></label>
      {state === 'success' && <p role="status" className="text-sm">{content.success}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  </section>
}
