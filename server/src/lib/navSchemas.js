import { z } from 'zod'

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

// Banners del Home (el hero). Se guarda la lista completa, ordenada.
export const homeBannersSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(60),
      eyebrow: z.string().trim().max(60).optional().default(''),
      title: text('El título', 80),
      subtitle: z.string().trim().max(200).optional().default(''),
      ctaLabel: z.string().trim().max(40).optional().default('Ver más'),
      href: linkHref,
      image: z.string().trim().max(1000).nullable().optional(),
      active: z.boolean(),
    }),
  )
  .max(10, 'Máximo 10 banners.')

// Enlaces del pie de /carrito (5, con el mismo orden que sus íconos).
export const cartFooterLinksSchema = z
  .array(z.object({ label: text('El texto', 80), href: linkHref }))
  .length(5, 'Deben ser exactamente 5 enlaces.')

export const SITE_SETTING_SCHEMAS = {
  seasonalPromo: seasonalPromoSchema,
  homeBanners: homeBannersSchema,
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