import { z } from 'zod'
import { storeBusinessSchema } from './storeBusinessSchema.js'
import { homeLayoutSchema } from './homeSchemas.js'
import { footerSchema, legalPagesSchema } from './footerContent.js'

// Esquemas zod 4 de los endpoints nuevos (nav, marcas, categorías en árbol,
// búsquedas populares, tiendas, ajustes). Los mensajes usan la sintaxis de
// zod 4 (`{ error: '...' }` o string directo como segundo argumento).

const text = (label, max = 200) =>
  z.string({ error: `${label} es obligatorio.` }).trim().min(1, `${label} es obligatorio.`).max(max, `${label} es demasiado largo.`)

// Enlace interno ("/catalogo") o absoluto (https://...). Vacío/null → null.
const href = z
  .string({ error: 'El enlace debe ser texto.' })
  .trim()
  .max(500, 'El enlace es demasiado largo.')
  .regex(/^(\/|https?:\/\/)/, 'El enlace debe empezar con "/" o "https://".')
  .nullable()
  .optional()

const imageUrl = z.string().trim().max(1000).nullable().optional()
const position = z.number({ error: 'La posición debe ser un número.' }).int().min(0).max(100000)
const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo admite minúsculas, números y guiones.')
  .max(120)

// ---- Marcas ----
export const brandCreateSchema = z.object({
  name: text('El nombre', 120),
  slug: slugField.optional(),
  logo: imageUrl,
  featured: z.boolean().optional(),
  featuredPosition: position.optional(),
  visible: z.boolean().optional(),
})
export const brandUpdateSchema = brandCreateSchema.partial()

// ---- Búsquedas populares ----
export const popularSearchCreateSchema = z.object({
  text: text('El texto', 80),
  position: position.optional(),
  active: z.boolean().optional(),
})
export const popularSearchUpdateSchema = popularSearchCreateSchema.partial()

// ---- Tiendas ----
export const storeCreateSchema = z.object({
  name: text('El nombre', 120),
  address1: text('La dirección', 160),
  address2: z.string().trim().max(160).nullable().optional(),
  city: text('La ciudad', 120),
  postalCode: z.string().trim().max(20).nullable().optional(),
  opensAt: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'El horario debe tener formato HH:MM (ej. 10:00).')
    .nullable()
    .optional(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  position: position.optional(),
})
export const storeUpdateSchema = storeCreateSchema.partial()

// ---- Ajustes del sitio (cada clave tiene su propio schema) ----
export const seasonalPromoSchema = z.object({
  label: text('El texto de la promo', 80),
  href: z.string().trim().regex(/^(\/|https?:\/\/)/, 'El enlace debe empezar con "/" o "https://".').max(500),
  visible: z.boolean(),
})

const linkHref = z.string().trim().regex(/^(\/|https?:\/\/)/, 'El enlace debe empezar con "/" o "https://".').max(500)

// ---------------------------------------------------------------------------
// Banners del Home. UN solo modelo para el hero (Cambio 2) y para los banners
// intercalados del compositor de la Home (Cambio 5): placement/width/slot ya
// existen desde ahora para no hacer una segunda migración.
// Se guardan en site_settings["homeBanners"] como lista ordenada.
// ---------------------------------------------------------------------------
export const BANNER_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]
export const BANNER_ALIGNS = ['left', 'center', 'right', 'justify']

const bannerButtonSchema = z.object({
  label: text('El texto del botón', 40),
  href: linkHref,
  style: z.enum(['primary', 'secondary'], { error: 'El estilo debe ser primary o secondary.' }).default('primary'),
})

const optionalUrl = z.string().trim().max(1000).nullable().optional().transform((v) => v || null)
const isoDate = z.iso.datetime({ offset: true, error: 'Fecha inválida.' }).nullable().optional().transform((v) => v || null)

export const bannerSchema = z
  .object({
    id: z.string().min(1).max(60),
    eyebrow: z.string().trim().max(60).optional().default(''),
    title: z.string().trim().max(80, 'El título es demasiado largo.').optional().default(''),
    description: z.string().trim().max(240, 'La descripción es demasiado larga.').optional().default(''),
    buttons: z.array(bannerButtonSchema).max(2, 'Máximo 2 botones.').optional().default([]),
    imageDesktop: optionalUrl,
    imageMobile: optionalUrl,
    imageAlt: z.string().trim().max(160).optional().default(''),
    position: z.enum(BANNER_POSITIONS, { error: 'Posición inválida.' }).optional().default('bottom-left'),
    textAlign: z.enum(BANNER_ALIGNS, { error: 'Alineación inválida.' }).optional().default('left'),
    textColor: z.enum(['light', 'dark'], { error: 'El color del texto debe ser light o dark.' }).optional().default('light'),
    overlay: z.number({ error: 'La opacidad debe ser un número.' }).int().min(0).max(80).optional().default(35),
    active: z.boolean().optional().default(true),
    startsAt: isoDate,
    endsAt: isoDate,
    placement: z.enum(['hero', 'inline'], { error: 'placement debe ser hero o inline.' }).optional().default('hero'),
    width: z.enum(['full', 'half'], { error: 'width debe ser full o half.' }).optional().default('full'),
    slot: z.string().trim().max(40).optional().default(''),
  })
  .refine((b) => b.title || b.imageDesktop, { error: 'El banner necesita al menos un título o una imagen.', path: ['title'] })
  .refine((b) => !b.startsAt || !b.endsAt || new Date(b.endsAt) > new Date(b.startsAt), {
    error: 'La fecha de fin debe ser posterior a la de inicio.',
    path: ['endsAt'],
  })

export const homeBannersSchema = z.array(bannerSchema).max(30, 'Máximo 30 banners.')

// Migración de la forma ANTERIOR (eyebrow/title/subtitle/ctaLabel/href/image/active)
// a la nueva, con los valores por defecto acordados: hero, abajo-izquierda,
// texto a la izquierda. Es idempotente: lo que ya tiene la forma nueva no se toca.
export function legacyBannerToNew(b) {
  if (!b || typeof b !== 'object') return b
  if ('buttons' in b || 'imageDesktop' in b || 'description' in b) return b
  return {
    id: b.id,
    eyebrow: b.eyebrow ?? '',
    title: b.title ?? '',
    description: b.subtitle ?? '',
    buttons: b.href ? [{ label: b.ctaLabel || 'Ver más', href: b.href, style: 'primary' }] : [],
    imageDesktop: b.image ?? null,
    imageMobile: null,
    position: 'bottom-left',
    textAlign: 'left',
    textColor: 'light',
    overlay: 35,
    active: b.active !== false,
    placement: 'hero',
    width: 'full',
    slot: '',
  }
}

// Lee lo guardado (forma antigua o nueva) y devuelve SIEMPRE la forma nueva.
// Los elementos que no validan se omiten para que un dato dañado no rompa el Home.
export function normalizeHomeBanners(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((b) => bannerSchema.safeParse(legacyBannerToNew(b)))
    .filter((r) => r.success)
    .map((r) => r.data)
}

// ¿Está vigente? (activo y dentro de su ventana de fechas)
export function isBannerLive(b, now = new Date()) {
  if (!b.active) return false
  if (b.startsAt && new Date(b.startsAt) > now) return false
  if (b.endsAt && new Date(b.endsAt) <= now) return false
  return true
}

// Ajustes globales del carrusel del hero.
export const heroCarouselSchema = z.object({
  intervalSeconds: z.number({ error: 'Los segundos deben ser un número.' }).int().min(3, 'Mínimo 3 segundos.').max(30, 'Máximo 30 segundos.'),
  autoplay: z.boolean({ error: 'autoplay debe ser verdadero o falso.' }),
})

// Enlaces del pie de /carrito (5, con el mismo orden que sus íconos).
export const cartFooterLinksSchema = z
  .array(z.object({ label: text('El texto', 80), href: linkHref }))
  .length(5, 'Deben ser exactamente 5 enlaces.')

// ---------------------------------------------------------------------------
// Menú principal (panel flotante del botón «Menú»).
//   menuLayout: filas del PRIMER nivel, en orden. Tres tipos:
//     brands   → la fila «Comprar por marca» (abre las marcas destacadas)
//     category → una categoría raíz del árbol (los niveles inferiores se editan en
//                Categorías); admite etiqueta/destino propios y ocultarla SOLO del Menú
//     custom   → fila personalizada (texto + enlace)
//   Si no existe, el Menú se arma como siempre: «Comprar por marca» + categorías
//   en el orden del árbol. Las categorías raíz sin fila se agregan al final.
//   menuTexts: textos fijos del panel («Explora {name}», «Todas las marcas»).
// ---------------------------------------------------------------------------
const rowId = z.string().min(1).max(60)
const rowLabel = z.string().trim().max(60, 'El texto es demasiado largo.').optional().default('')
const rowVisible = z.boolean().optional().default(true)
const optionalHref = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^(\/|https?:\/\/)/.test(v), { error: 'El enlace debe empezar con "/" o "https://".' })

export const menuLayoutSchema = z
  .array(
    z.discriminatedUnion('type', [
      z.object({ id: rowId, type: z.literal('brands'), label: rowLabel, visible: rowVisible }),
      z.object({ id: rowId, type: z.literal('category'), categoryId: z.string().min(1).max(60), label: rowLabel, href: optionalHref, visible: rowVisible }),
      z.object({ id: rowId, type: z.literal('custom'), label: text('El texto', 60), href: z.string({ error: 'El enlace es obligatorio.' }).pipe(linkHref), visible: rowVisible }),
    ]),
  )
  .max(80, 'Máximo 80 filas.')
  .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length, { error: 'Hay filas con el mismo id.' })
  .refine((rows) => rows.filter((r) => r.type === 'brands').length <= 1, { error: 'Solo puede haber una fila «Comprar por marca».' })
  .refine((rows) => {
    const ids = rows.filter((r) => r.type === 'category').map((r) => r.categoryId)
    return new Set(ids).size === ids.length
  }, { error: 'Una categoría no puede estar dos veces en el Menú.' })

export const menuTextsSchema = z.object({
  exploreTemplate: z.string({ error: 'El texto es obligatorio.' }).trim().min(1, 'El texto es obligatorio.').max(60, 'Máximo 60 caracteres.'),
  allBrandsLabel: z.string({ error: 'El texto es obligatorio.' }).trim().min(1, 'El texto es obligatorio.').max(40, 'Máximo 40 caracteres.'),
})

// ---------------------------------------------------------------------------
// Fila de círculos de la Home («Compra por categoría»).
//   items = null  → modo automático: categorías visibles de primer nivel, en el orden del árbol.
//   items = [...] → lista elegida: categorías del árbol (con etiqueta/imagen propias opcionales)
//                   y círculos personalizados (imagen + texto + enlace).
//   onlyWithProducts: oculta las categorías sin productos (no afecta a los personalizados).
//   max: tope de ítems (null = todos).
// ---------------------------------------------------------------------------
export const homeCirclesSchema = z.object({
  title: z.string({ error: 'El título es obligatorio.' }).trim().min(1, 'El título es obligatorio.').max(60, 'Máximo 60 caracteres.').optional().default('Compra por categoría'),
  onlyWithProducts: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional().default(true),
  max: z.number({ error: 'El máximo debe ser un número.' }).int('El máximo debe ser un entero.').min(1, 'El máximo debe ser al menos 1.').max(200, 'El máximo es 200.').nullable().optional().default(null),
  items: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ id: rowId, type: z.literal('category'), categoryId: z.string().min(1).max(60), label: rowLabel, image: optionalUrl, visible: rowVisible }),
        z.object({ id: rowId, type: z.literal('custom'), label: text('El texto', 60), href: z.string({ error: 'El enlace es obligatorio.' }).pipe(linkHref), image: optionalUrl, visible: rowVisible }),
      ]),
    )
    .max(200, 'Máximo 200 ítems.')
    .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length, { error: 'Hay ítems con el mismo id.' })
    .refine((rows) => {
      const ids = rows.filter((r) => r.type === 'category').map((r) => r.categoryId)
      return new Set(ids).size === ids.length
    }, { error: 'Una categoría no puede estar dos veces.' })
    .nullable()
    .optional()
    .default(null),
})

export const SITE_SETTING_SCHEMAS = {
  storeBusiness: storeBusinessSchema,
  footerContent: footerSchema,
  legalPages: legalPagesSchema,
  seasonalPromo: seasonalPromoSchema,
  homeBanners: homeBannersSchema,
  homeLayout: homeLayoutSchema,
  heroCarousel: heroCarouselSchema,
  menuLayout: menuLayoutSchema,
  menuTexts: menuTextsSchema,
  homeCircles: homeCirclesSchema,
  cartFooterLinks: cartFooterLinksSchema,
}

// ---- Ítems de navegación ----
export const NAV_MENU_KEYS = ['acuerdos', 'soporte', 'descubre', 'mas', 'quick']
export const NAV_ITEM_TYPES = ['LINK', 'HEADING', 'DIVIDER', 'SUBMENU', 'PROMO']

const navItemBase = z.object({
  menuKey: z.enum(NAV_MENU_KEYS, { error: `menuKey debe ser uno de: ${NAV_MENU_KEYS.join(', ')}.` }),
  parentId: z.string().nullable().optional(),
  type: z.enum(NAV_ITEM_TYPES, { error: `type debe ser uno de: ${NAV_ITEM_TYPES.join(', ')}.` }).optional(),
  label: z.string().trim().max(120).optional(),
  href,
  position: position.optional(),
  visible: z.boolean().optional(),
})
// DIVIDER y PROMO no necesitan texto propio; los demás sí.
export const navItemCreateSchema = navItemBase.refine(
  (v) => ['DIVIDER', 'PROMO'].includes(v.type ?? 'LINK') || (v.label && v.label.length > 0),
  { error: 'El texto es obligatorio.', path: ['label'] },
)
export const navItemUpdateSchema = navItemBase.partial()
export const navReorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string(), position, parentId: z.string().nullable().optional() }))
    .min(1, 'No hay ítems para reordenar.')
    .max(500),
})

// ---- Categorías en árbol ----
export const categoryNodeCreateSchema = z.object({
  name: text('El nombre', 160),
  slug: slugField.optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(60).nullable().optional(),
  image: imageUrl,
  position: position.optional(),
  visible: z.boolean().optional(),
  legacy: z.boolean().optional(),
})
export const categoryNodeUpdateSchema = categoryNodeCreateSchema.partial()

export const tileCreateSchema = z.object({
  title: text('El título', 120),
  image: imageUrl,
  href,
  position: position.optional(),
  visible: z.boolean().optional(),
})
export const tileUpdateSchema = tileCreateSchema.partial()

// ---- Asignación (masiva) de productos a categoría y/o marca ----
export const assignProductsSchema = z
  .object({
    productIds: z.array(z.string()).min(1, 'Selecciona al menos un producto.').max(1000),
    categoryId: z.string().optional(),
    brandId: z.string().nullable().optional(),
  })
  .refine((v) => v.categoryId !== undefined || v.brandId !== undefined, {
    error: 'Indica categoryId y/o brandId.',
  })

// ---- Elementos guardados ----
export const savedItemSchema = z.object({
  productId: z.string({ error: 'productId es obligatorio.' }).min(1, 'productId es obligatorio.'),
})
export const savedMergeSchema = z.object({
  productIds: z.array(z.string()).max(200, 'Demasiados elementos.'),
})
