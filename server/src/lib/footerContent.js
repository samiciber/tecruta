import { z } from 'zod'
import { storeConfig } from '../../../src/config/storeConfig.js'
import { validContentUrl } from './contentLinks.js'

export const contentHref = z.string().trim().min(1).max(500).refine(value => {
  if (!validContentUrl(value)) return false
  if (!value.startsWith('/')) return true
  const path = value.split(/[?#]/)[0]
  return ['/', '/catalogo', '/categorias', '/ayuda', '/marcas', '/pagos', '/mi-tarjeta', '/planes', '/elementos-guardados', '/iniciar-sesion', '/crear-cuenta', '/mis-pedidos', '/mis-direcciones', '/mi-cuenta'].includes(path) || /^\/(?:categoria|marca|producto)\/[^/]+$/.test(path) || /^\/legal\/(?:terminos|privacidad)$/.test(path)
}, 'Usa una ruta disponible o un enlace HTTPS válido, sin espacios ni credenciales.')
const text = max => z.string().trim().max(max)
const id = z.string().min(1).max(60)
const link = z.object({ id, label: text(80), href: contentHref, visible: z.boolean().default(true) })
export const footerSchema = z.object({
  brand: text(80), description: text(500), contactTitle: text(80),
  contactLines: z.array(text(180)).max(8),
  email: z.union([z.literal(''), z.email()]), whatsapp: z.string().regex(/^\d{7,16}$|^$/),
  groups: z.array(z.object({ id, title: text(80), visible: z.boolean().default(true), source: z.enum(['custom', 'support']).default('custom'), links: z.array(link).max(15) })).max(6),
  socials: z.array(z.object({ id, label: text(60), platform: z.enum(['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin']), href: contentHref, visible: z.boolean().default(true) })).max(8),
  newsletter: z.object({ enabled: z.boolean(), title: text(100), description: text(500), label: text(60), placeholder: text(80), consent: text(300), button: text(40), success: text(300) }),
  copyright: text(180),
  legalLinks: z.array(z.object({ id, label: text(60), type: z.enum(['terminos', 'privacidad']), visible: z.boolean().default(true) })).max(2),
}).superRefine((value, ctx) => {
  for (const [key, items] of Object.entries({ groups: value.groups, socials: value.socials, legalLinks: value.legalLinks })) {
    if (new Set(items.map(i => i.id)).size !== items.length) ctx.addIssue({ code: 'custom', path: [key], message: 'Los identificadores deben ser únicos.' })
  }
  value.groups.forEach((group, index) => {
    if (new Set(group.links.map(i => i.id)).size !== group.links.length) ctx.addIssue({ code: 'custom', path: ['groups', index, 'links'], message: 'Los enlaces deben tener identificadores únicos.' })
  })
  if (value.newsletter.enabled && ['title', 'description', 'label', 'consent', 'button', 'success'].some(key => !value.newsletter[key])) ctx.addIssue({ code: 'custom', path: ['newsletter'], message: 'Completa los textos de suscripción o desactiva el bloque.' })
})
export const footerDefaults = footerSchema.parse({
  brand: storeConfig.name, description: storeConfig.description, contactTitle: 'Contacto',
  contactLines: [],
  email: '', whatsapp: '',
  groups: [
    { id: 'comprar', title: 'Comprar', visible: true, links: [{ id: 'catalogo', label: 'Productos', href: '/catalogo' }, { id: 'categorias', label: 'Categorías', href: '/categorias' }, { id: 'ofertas', label: 'Ofertas', href: '/catalogo?ordenar=discount' }] },
    { id: 'ayuda', title: 'Ayuda', visible: true, source: 'support', links: [] },
  ],
  socials: [],
  newsletter: { enabled: true, title: 'Novedades de TecRuta', description: 'Deja tu correo para suscribirte a las novedades de TecRuta.', label: 'Correo electrónico', placeholder: 'tu@correo.com', consent: 'Acepto suscribirme y he leído la política de privacidad.', button: 'Suscribirme', success: 'Tu suscripción quedó registrada.' },
  copyright: storeConfig.name,
  legalLinks: [{ id: 'terminos', label: 'Términos', type: 'terminos' }, { id: 'privacidad', label: 'Privacidad', type: 'privacidad' }],
})
export function resolveFooter(settings) {
  const footer = footerSchema.parse(settings.footerContent ?? footerDefaults)
  return { ...footer, groups: footer.groups.filter(g => g.visible).map(g => ({ ...g, links: g.source === 'support'
    ? (Array.isArray(settings.cartFooterLinks) ? settings.cartFooterLinks : []).filter(l => l.label && contentHref.safeParse(l.href).success).map((l, i) => ({ ...l, id: `support-${i}`, visible: true }))
    : g.links.filter(l => l.visible && l.label) })).filter(g => g.title && g.links.length), socials: footer.socials.filter(s => s.visible && s.label), legalLinks: footer.legalLinks.filter(l => l.visible && l.label) }
}
// Empty documents are explicitly unpublished; administrators can save a draft.
const legalPage = z.object({ title: text(120).min(1), body: text(18000) })
export const legalPagesSchema = z.object({ terminos: legalPage, privacidad: legalPage })
