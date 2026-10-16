import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useUnsavedContent } from '../../hooks/useUnsavedContent.js'
import { Field, Check, SectionHeader } from '../../components/admin/adminUi.jsx'
const newId = () => `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
function Text({ label, value, onChange, multiline = false, max = 500 }) {
  return <Field label={label}>{multiline ? <textarea maxLength={max} rows={5} className="input-tr py-2" value={value} onChange={e => onChange(e.target.value)} /> : <input maxLength={max} className="input-tr" value={value} onChange={e => onChange(e.target.value)} />}</Field>
}
function Controls({ index, length, onMove, onRemove }) { return <div className="my-3 flex flex-wrap gap-3 text-xs"><button type="button" className="btn-secondary px-3 py-2" disabled={!index} onClick={() => onMove(-1)}>Subir</button><button type="button" className="btn-secondary px-3 py-2" disabled={index === length - 1} onClick={() => onMove(1)}>Bajar</button><button type="button" className="btn-secondary px-3 py-2" onClick={() => { if (window.confirm('¿Quitar este elemento del borrador?')) onRemove() }}>Quitar</button></div> }
function moved(items, index, direction) { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next }
const panel = 'space-y-4 rounded-xl2 border border-paper-line p-4 dark:border-night-line'
export default function AdminFooter() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const dirty = Boolean(data && saved && JSON.stringify(data) !== JSON.stringify(saved))
  useUnsavedContent(dirty)
  const load = useCallback(async () => { try { const result = await api.admin.getFooter(token); setData(result); setSaved(result); setError('') } catch (err) { setError(err.message) } }, [token])
  useEffect(() => { load() }, [load])
  const footer = data?.footer
  const patch = value => setData(current => ({ ...current, footer: { ...current.footer, ...value } }))
  const groupPatch = (index, value) => patch({ groups: footer.groups.map((g, i) => i === index ? { ...g, ...value } : g) })
  const save = async () => {
    setBusy(true); setError(''); setMessage('')
    try { const result = await api.admin.saveFooter(data, token); setData(result); setSaved(result); setMessage('Contenido guardado. Se conservará al recargar.') } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <section aria-labelledby="footer-editor-title">
    <SectionHeader id="footer-editor-title" title="Footer y contenido legal" description="Contenido público del sitio. Los enlaces de soporte se editan una sola vez en Ajustes del sitio.">
      <div className="flex flex-wrap gap-2"><button className="btn-secondary px-4 py-2" disabled={!dirty} onClick={() => { if (window.confirm('¿Descartar los cambios sin guardar?')) { setData(saved); setError('') } }}>Descartar cambios</button><button className="btn-primary px-4 py-2" disabled={!dirty || busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar contenido'}</button></div>
    </SectionHeader>
    {dirty && <p role="status" className="my-3 text-sm">Hay cambios sin guardar.</p>}
    {message && <p role="status" className="my-3 text-sm">{message}</p>}
    {error && <p role="alert" className="my-3 text-sm text-red-700 dark:text-red-300">{error}{!data && <button onClick={load} className="ml-2 underline">Reintentar</button>}</p>}
    {!data && !error && <p role="status">Cargando contenido…</p>}
    {data && <div className="space-y-5">
      <details open className={panel}><summary className="cursor-pointer font-semibold">Marca y contacto</summary>
        <div className="grid gap-4 sm:grid-cols-2"><Text label="Nombre del sitio en el footer" max={80} value={footer.brand} onChange={brand => patch({ brand })} /><Text label="Título del contacto" max={80} value={footer.contactTitle} onChange={contactTitle => patch({ contactTitle })} />
          <Text multiline label="Descripción del sitio" value={footer.description} onChange={description => patch({ description })} /><Text multiline label="Ubicación y horarios (una línea por dato, máximo 8)" max={1440} value={footer.contactLines.join('\n')} onChange={value => patch({ contactLines: value.split('\n') })} />
          <Text label="Correo de contacto" max={254} value={footer.email} onChange={email => patch({ email })} /><Text label="WhatsApp (número internacional, sin signos)" max={16} value={footer.whatsapp} onChange={whatsapp => patch({ whatsapp })} />
        </div>
      </details>
      <details className={panel}><summary className="cursor-pointer font-semibold">Grupos y enlaces</summary>
        {footer.groups.map((group, index) => <fieldset key={group.id} className={panel}><legend>Grupo {index + 1}</legend><Text label="Título del grupo" max={80} value={group.title} onChange={title => groupPatch(index, { title })} /><Check label="Grupo visible" checked={group.visible} onChange={visible => groupPatch(index, { visible })} />
          <Field label="Fuente del grupo"><select className="input-tr" value={group.source} onChange={e => groupPatch(index, { source: e.target.value })}><option value="custom">Enlaces propios</option><option value="support">Enlaces compartidos del carrito</option></select></Field>
          {group.source === 'support' ? <p className="text-sm">Usa cartFooterLinks de Ajustes del sitio. Destinos pendientes como /proximamente no se publican aquí.</p> : <>
            {group.links.map((link, i) => <fieldset key={link.id} className={panel}><legend>Enlace {i + 1}</legend><Text label="Etiqueta del enlace" max={80} value={link.label} onChange={label => groupPatch(index, { links: group.links.map((l, j) => j === i ? { ...l, label } : l) })} /><Text label="Destino del enlace" value={link.href} onChange={href => groupPatch(index, { links: group.links.map((l, j) => j === i ? { ...l, href } : l) })} /><Check label="Enlace visible" checked={link.visible} onChange={visible => groupPatch(index, { links: group.links.map((l, j) => j === i ? { ...l, visible } : l) })} /><Controls index={i} length={group.links.length} onMove={direction => groupPatch(index, { links: moved(group.links, i, direction) })} onRemove={() => groupPatch(index, { links: group.links.filter((_, j) => j !== i) })} /></fieldset>)}
            <button className="btn-secondary px-3 py-2" disabled={group.links.length >= 15} onClick={() => groupPatch(index, { links: [...group.links, { id: newId(), label: '', href: '/', visible: true }] })}>Agregar enlace</button>
          </>}
          <Controls index={index} length={footer.groups.length} onMove={direction => patch({ groups: moved(footer.groups, index, direction) })} onRemove={() => patch({ groups: footer.groups.filter((_, i) => i !== index) })} />
        </fieldset>)}
        <button className="btn-secondary px-3 py-2" disabled={footer.groups.length >= 6} onClick={() => patch({ groups: [...footer.groups, { id: newId(), title: '', source: 'custom', visible: true, links: [] }] })}>Agregar grupo</button>
      </details>
      <details className={panel}><summary className="cursor-pointer font-semibold">Redes sociales</summary>
        {footer.socials.map((social, index) => <fieldset key={social.id} className={panel}><legend>Red {index + 1}</legend><Field label="Plataforma"><select className="input-tr" value={social.platform} onChange={e => patch({ socials: footer.socials.map((s, i) => i === index ? { ...s, platform: e.target.value } : s) })}>{['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin'].map(p => <option key={p}>{p}</option>)}</select></Field>
          {['label', 'href'].map(key => <Text key={key} label={key === 'label' ? 'Nombre accesible de la red' : 'URL de la red'} value={social[key]} onChange={value => patch({ socials: footer.socials.map((s, i) => i === index ? { ...s, [key]: value } : s) })} />)}
          <Check label="Red visible" checked={social.visible} onChange={visible => patch({ socials: footer.socials.map((s, i) => i === index ? { ...s, visible } : s) })} /><Controls index={index} length={footer.socials.length} onMove={direction => patch({ socials: moved(footer.socials, index, direction) })} onRemove={() => patch({ socials: footer.socials.filter((_, i) => i !== index) })} />
        </fieldset>)}
        <button className="btn-secondary px-3 py-2" disabled={footer.socials.length >= 8} onClick={() => patch({ socials: [...footer.socials, { id: newId(), label: '', platform: 'facebook', href: 'https://www.facebook.com/', visible: false }] })}>Agregar red</button>
      </details>
      <details className={panel}><summary className="cursor-pointer font-semibold">Suscripción por correo</summary><Check label="Mostrar formulario de suscripción" checked={footer.newsletter.enabled} onChange={enabled => patch({ newsletter: { ...footer.newsletter, enabled } })} />
        {Object.entries({ title: 'Título de suscripción', description: 'Descripción de suscripción', label: 'Etiqueta del correo', placeholder: 'Ejemplo de correo', consent: 'Texto de aceptación', button: 'Texto del botón', success: 'Mensaje después de guardar' }).map(([key, label]) => <Text key={key} label={label} value={footer.newsletter[key]} max={{ title: 100, label: 60, placeholder: 80, consent: 300, button: 40, success: 300 }[key] || 500} onChange={value => patch({ newsletter: { ...footer.newsletter, [key]: value } })} />)}
      </details>
      <details className={panel}><summary className="cursor-pointer font-semibold">Barra y documentos legales</summary><Text label="Texto de copyright (el año se agrega automáticamente)" value={footer.copyright} max={180} onChange={copyright => patch({ copyright })} />
        {footer.legalLinks.map((link, index) => <fieldset key={link.id} className={panel}><legend>{link.type}</legend><Text label="Etiqueta legal" max={60} value={link.label} onChange={label => patch({ legalLinks: footer.legalLinks.map((l, i) => i === index ? { ...l, label } : l) })} /><Check label="Enlace legal visible" checked={link.visible} onChange={visible => patch({ legalLinks: footer.legalLinks.map((l, i) => i === index ? { ...l, visible } : l) })} /><Controls index={index} length={footer.legalLinks.length} onMove={direction => patch({ legalLinks: moved(footer.legalLinks, index, direction) })} onRemove={() => patch({ legalLinks: footer.legalLinks.filter((_, i) => i !== index) })} /></fieldset>)}
        <button className="btn-secondary px-3 py-2" disabled={footer.legalLinks.length >= 2} onClick={() => { const type = ['terminos', 'privacidad'].find(t => !footer.legalLinks.some(l => l.type === t)); if (type) patch({ legalLinks: [...footer.legalLinks, { id: newId(), type, label: type, visible: true }] }) }}>Agregar enlace legal</button>
        {Object.entries(data.legal).map(([type, page]) => <fieldset key={type} className={panel}><legend>{type === 'terminos' ? 'Términos y condiciones' : 'Privacidad'}</legend><Text label={`Título de ${type}`} value={page.title} max={120} onChange={title => setData(current => ({ ...current, legal: { ...current.legal, [type]: { ...page, title } } }))} /><Text multiline label={`Contenido de ${type} (texto plano)`} value={page.body} max={18000} onChange={body => setData(current => ({ ...current, legal: { ...current.legal, [type]: { ...page, body } } }))} /></fieldset>)}
      </details>
    </div>}
  </section>
}
