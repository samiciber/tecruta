import { z } from 'zod'

const object = fields => z.strictObject(fields, { error: 'Envía un objeto con los campos permitidos.' })
const text = (label, max = 200) => z.string({ error: `${label} debe ser texto.` }).trim()
  .min(1, `${label} no puede estar vacío.`).max(max, `${label} es demasiado largo.`)
const optionalText = (max = 10000) => z.string({ error: 'El campo debe ser texto.' }).trim()
  .max(max, 'El texto es demasiado largo.').transform(value => value || null).nullable().optional()
const boolean = z.boolean({ error: 'El campo debe ser verdadero o falso.' })
const money = z.number({ error: 'El importe debe ser un número finito.' })
  .min(0, 'El importe no puede ser negativo.').max(99999999.99, 'El importe excede el máximo permitido.')
  .multipleOf(0.01, 'El importe admite como máximo dos decimales.')
const stock = z.number({ error: 'El stock debe ser un número.' })
  .int('El stock debe ser entero.').min(0, 'El stock no puede ser negativo.').max(2147483647, 'El stock excede el máximo permitido.')
const sku = z.string({ error: 'El SKU debe ser texto.' }).trim().max(40, 'El SKU no puede superar 40 caracteres.')
  .refine(value => !value || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value), 'El SKU solo admite letras, números, puntos, guiones y guiones bajos.')
  .transform(value => value || null).nullable().optional()
const slug = text('El slug').regex(/^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/, 'El slug solo admite letras, números, guiones y guiones bajos.')
const media = z.string({ error: 'La URL debe ser texto.' }).trim().max(2000, 'La URL es demasiado larga.')
  .refine(value => {
    if (!value) return true
    if (/[\\\x00-\x20]/.test(value)) return false
    if (/^\/(?!\/)/.test(value)) return true
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
  }, 'Usa una URL HTTP(S) o una ruta local válida.').transform(value => value || null)
const json = z.json({ error: 'El campo debe contener datos JSON válidos.' })
const productFields = {
  slug, name: text('El nombre'), category: text('La categoría'), sku,
  brand: optionalText(120), brandId: text('El ID de marca').nullable().optional(),
  price: money, compareAtPrice: money.nullable().optional(), stock: stock.optional(), expectedStock: stock.optional(), stockReason: optionalText(240),
  featured: boolean.optional(), bestSeller: boolean.optional(),
  image: media.nullable().optional(), images: z.array(media.refine(value => value !== null, 'La URL de imagen no puede estar vacía.'), { error: 'Las imágenes deben ser una lista.' }).max(50, 'Máximo 50 imágenes.').optional(),
  description: optionalText(), shortDescription: optionalText(2000),
  tags: z.array(text('La etiqueta', 100), { error: 'Las etiquetas deben ser una lista.' }).max(100, 'Máximo 100 etiquetas.').optional(),
  specifications: z.array(object({
    label: z.string({ error: 'La etiqueta debe ser texto.' }).trim().max(200, 'La etiqueta es demasiado larga.'),
    value: z.string({ error: 'El valor debe ser texto.' }).trim().max(2000, 'El valor es demasiado largo.'),
  }).refine(value => Boolean(value.label || value.value), 'Completa la etiqueta o el valor.'), { error: 'Las especificaciones deben ser una lista.' })
    .max(100, 'Máximo 100 especificaciones.').nullable().optional(),
  model3DUrl: media.nullable().optional(), model3DPoster: media.nullable().optional(), enable3D: boolean.optional(),
  hotspots: z.array(object({
    id: text('El ID de hotspot').optional(),
    x: z.number({ error: 'La coordenada x debe ser finita.' }),
    y: z.number({ error: 'La coordenada y debe ser finita.' }),
    z: z.number({ error: 'La coordenada z debe ser finita.' }),
    title: text('El título'), description: z.string({ error: 'La descripción debe ser texto.' }).trim().max(2000, 'La descripción es demasiado larga.').optional(),
  }), { error: 'Los hotspots deben ser una lista.' }).max(100, 'Máximo 100 hotspots.').nullable().optional(),
}
const nonemptyPatch = schema => schema.refine(value => Object.keys(value).length > 0, 'Envía al menos un campo para editar.')
export const productCreateSchema = object(productFields)
export const productUpdateSchema = nonemptyPatch(productCreateSchema.partial())
export const categoryCreateSchema = object({ slug, name: text('El nombre'), description: optionalText(), icon: optionalText(200) })
export const categoryUpdateSchema = nonemptyPatch(object({ name: text('El nombre').optional(), description: optionalText(), icon: optionalText(200) }))
export const paymentMethodUpdateSchema = nonemptyPatch(object({
  label: text('El nombre').optional(), active: boolean.optional(),
  config: z.record(z.string(), json, { error: 'La configuración debe ser un objeto JSON.' }).optional(),
}))
