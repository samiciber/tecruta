import { z } from 'zod'
import { validContentUrl } from './contentLinks.js'

const href = z.string().trim().min(1).max(500).refine(validContentUrl, 'Usa una ruta interna o URL HTTPS válida, sin espacios ni credenciales.')
const slug = z.string().trim().min(1).max(120)
const id = z.string().trim().min(1).max(60)

const homeSourceSchema = z.object({
  id,
  label: z.string().trim().min(1).max(60),
  kind: z.enum(['featured', 'bestSeller', 'discount', 'category', 'brand', 'manual']),
  productIds: z.array(id).max(20).optional(),
  slug: slug.optional(),
  href: href.optional(),
}).superRefine((source, ctx) => {
  if (['category', 'brand'].includes(source.kind) && !source.slug) {
    ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Selecciona una categoría o marca.' })
  }
})

const base = { id, active: z.boolean().default(true), appearance: z.object({ tone: z.enum(['default', 'soft']), density: z.enum(['normal', 'compact']) }).optional() }
const title = z.string().trim().max(100).default('')
const description = z.string().trim().max(500).default('')
const image = z.union([z.literal(''), z.string().trim().min(1).max(1000).refine(value => validContentUrl(value, { http: true }))]).default('')
const optionalHref = z.union([z.literal(''), href]).default('')
const access = z.object({ id, title, href: optionalHref, image, imageMobile: image.optional(), imageAlt: z.string().trim().max(160).optional(), description })
export const HOME_BENEFIT_ICONS = ['info', 'package', 'headphones', 'mapPin', 'heart', 'monitor', 'helpCircle', 'fileText']
const sectionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('hero') }),
  z.object({ ...base, type: z.literal('circles') }),
  z.object({ ...base, type: z.literal('guestStrip'), message: z.string().trim().min(1).max(300).optional(), buttonLabel: z.string().trim().min(1).max(60).optional(), href: href.optional() }),
  z.object({
    ...base, type: z.literal('splitRow'), title,
    ratio: z.enum(['50/50', '60/40']).default('50/50'), reverse: z.boolean().default(false),
    bannerId: z.string().max(60).default(''),
    panelKind: z.enum(['categories', 'products']).default('categories'),
    categorySlugs: z.array(slug).max(12).default([]),
    source: homeSourceSchema.optional(), limit: z.number().int().min(1).max(20).default(6),
  }),
  z.object({
    ...base, type: z.literal('editorialTiles'), title,
    columns: z.union([z.literal(4), z.literal(5)]).default(4),
    items: z.array(access).max(5).default([]),
  }),
  z.object({ ...base, type: z.literal('brands'), title, limit: z.number().int().min(1).max(24).default(8) }),
  z.object({
    ...base, type: z.literal('benefits'), title,
    items: z.array(z.object({ id, icon: z.enum(HOME_BENEFIT_ICONS), title, text: z.string().trim().max(500).default('') })).max(4).default([]),
  }),
  z.object({ ...base, type: z.literal('supportLinks'), title }),
  z.object({ ...base, type: z.literal('legalText'), title, text: z.string().trim().max(6000).default('') }),
  z.object({
    ...base, type: z.literal('useSelections'), title,
    tabs: z.array(z.object({ id, label: z.string().trim().max(60), image, imageMobile: image.optional(),
      imageAlt: z.string().trim().max(160).default(''), links: z.array(access).max(6).default([]),
    })).max(8).default([]),
  }),
  z.object({
    ...base,
    type: z.literal('products'),
    title: z.string().trim().min(1).max(80),
    limit: z.number().int().min(1).max(20).default(8),
    sources: z.array(homeSourceSchema).min(1).max(6),
    panel: z.object({
      title: z.string().trim().min(1).max(80),
      description: z.string().trim().max(240).optional().default(''),
      label: z.string().trim().min(1).max(40),
      href,
    }).optional(),
  }),
  z.object({
    ...base,
    type: z.literal('inlineBanners'),
    slot: z.string().trim().min(1).max(40),
  }),
  z.object({
    ...base,
    type: z.literal('campaign'),
    title: z.string().trim().min(1).max(80),
    endsAt: z.iso.datetime({ offset: true }),
    limit: z.number().int().min(1).max(20).default(8),
    source: homeSourceSchema,
  }),
])

export const homeLayoutSchema = z.object({
  sections: z.array(sectionSchema).max(30),
}).superRefine((layout, ctx) => {
  const ids = layout.sections.map((section) => section.id)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Los identificadores de sección deben ser únicos.' })
  }
  layout.sections.forEach((section, index) => {
    const checkIds = (items, path) => {
      if (new Set(items.map(item => item.id)).size !== items.length) {
        ctx.addIssue({ code: 'custom', path: ['sections', index, ...path], message: 'Los identificadores deben ser únicos dentro del bloque.' })
      }
    }
    if (section.items) checkIds(section.items, ['items'])
    if (section.type === 'editorialTiles' && section.items.length > section.columns) {
      ctx.addIssue({ code: 'custom', path: ['sections', index, 'items'], message: 'La cantidad de tiles supera las columnas configuradas.' })
    }
    if (section.type === 'useSelections') {
      checkIds(section.tabs, ['tabs'])
      section.tabs.forEach((tab, tabIndex) => checkIds(tab.links, ['tabs', tabIndex, 'links']))
    }
  })
})
