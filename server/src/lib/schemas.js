import { z } from 'zod'

// -----------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------

const emailField = z.string().trim().min(1, 'El correo es obligatorio.').email('Ingresa un correo válido.')
const passwordField = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
const sixDigitCode = z.string().trim().regex(/^\d{6}$/, 'El código debe tener 6 dígitos.')

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.'),
  apellido: z.string().trim().min(1, 'El apellido es obligatorio.'),
  fechaNacimiento: z.string().trim().optional().nullable(),
})

export const emailOnlySchema = z.object({
  email: emailField,
})

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

export const verifySchema = z.object({
  email: emailField,
  code: sixDigitCode,
})

export const resetPasswordSchema = z.object({
  email: emailField,
  code: sixDigitCode,
  newPassword: passwordField,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
  newPassword: passwordField,
})

export const updateProfileSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre no puede estar vacío.').optional(),
  apellido: z.string().trim().min(1, 'El apellido no puede estar vacío.').optional(),
  fechaNacimiento: z.string().trim().optional().nullable(),
})

// -----------------------------------------------------------------------
// Pedidos
// -----------------------------------------------------------------------

export const createOrderSchema = z.object({
  customer: z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio.'),
    apellido: z.string().trim().min(1, 'El apellido es obligatorio.'),
    correo: z.string().trim().min(1, 'El correo es obligatorio.').email('Ingresa un correo válido.'),
    celular: z.string().trim().min(6, 'Ingresa un celular válido.'),
  }),
  delivery: z
    .object({
      tipoEntrega: z.enum(['envio', 'recojo']).default('envio'),
      departamento: z.string().trim().min(1, 'Falta el departamento.'),
      provincia: z.string().trim().min(1, 'Falta la provincia.'),
      distrito: z.string().trim().min(1, 'Falta el distrito.'),
      direccion: z.string().trim().optional().nullable(),
      numero: z.string().trim().optional().nullable(),
      interior: z.string().trim().optional().nullable(),
      referencia: z.string().trim().optional().nullable(),
      quiereComprobante: z.boolean().optional(),
      documento: z.string().trim().optional().nullable(),
      otraPersona: z.boolean().optional(),
      personaNombre: z.string().trim().optional().nullable(),
      personaCelular: z.string().trim().optional().nullable(),
    })
    // .passthrough() porque el frontend puede mandar algún campo de UI
    // extra (ej. aceptaTerminos) que no nos interesa persistir, pero que
    // tampoco debería hacer fallar la validación.
    .passthrough(),
  paymentMethod: z.string().trim().min(1).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, 'Falta el id del producto.'),
        quantity: z.number({ invalid_type_error: 'La cantidad debe ser un número.' }).int().positive(),
      }),
    )
    .min(1, 'El pedido debe tener al menos un producto.'),
})

// -----------------------------------------------------------------------
// Carrito
// -----------------------------------------------------------------------

export const addCartItemSchema = z.object({
  productId: z.string().trim().min(1, 'Falta el id del producto.'),
  quantity: z.number({ invalid_type_error: 'La cantidad debe ser un número.' }).int().positive(),
})

export const setCartItemQuantitySchema = z.object({
  // Puede ser <= 0: el endpoint lo interpreta como "eliminar este item".
  quantity: z.number({ invalid_type_error: 'La cantidad debe ser un número.' }).int(),
})

export const mergeCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().trim().min(1),
      quantity: z.number().int().positive(),
    }),
  ),
})

// -----------------------------------------------------------------------
// Direcciones
// -----------------------------------------------------------------------

const addressFields = {
  etiqueta: z.string().trim().optional().nullable(),
  departamento: z.string().trim().min(1, 'Falta el departamento.'),
  provincia: z.string().trim().min(1, 'Falta la provincia.'),
  distrito: z.string().trim().min(1, 'Falta el distrito.'),
  direccion: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  interior: z.string().trim().optional().nullable(),
  referencia: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
}

export const createAddressSchema = z.object(addressFields)

// En la edición todos los campos son opcionales (PATCH parcial), pero si
// se manda alguno de ubigeo, no puede venir vacío.
export const updateAddressSchema = z.object({
  etiqueta: z.string().trim().optional().nullable(),
  departamento: z.string().trim().min(1, 'El departamento no puede quedar vacío.').optional(),
  provincia: z.string().trim().min(1, 'La provincia no puede quedar vacía.').optional(),
  distrito: z.string().trim().min(1, 'El distrito no puede quedar vacío.').optional(),
  direccion: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  interior: z.string().trim().optional().nullable(),
  referencia: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
})
