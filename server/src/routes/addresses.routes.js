import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { validate } from '../middleware/validate.js'
import { createAddressSchema, updateAddressSchema } from '../lib/schemas.js'

export const addressesRouter = Router()

// Direcciones guardadas: solo tiene sentido para clientes con cuenta.
addressesRouter.use(requireAuth)

const EDITABLE_FIELDS = ['etiqueta', 'departamento', 'provincia', 'distrito', 'direccion', 'numero', 'interior', 'referencia']

function serializeAddress(a) {
  return {
    id: a.id,
    etiqueta: a.etiqueta,
    departamento: a.departamento,
    provincia: a.provincia,
    distrito: a.distrito,
    direccion: a.direccion,
    numero: a.numero,
    interior: a.interior,
    referencia: a.referencia,
    isDefault: a.isDefault,
  }
}

// Se asegura de que, como máximo, una dirección del usuario tenga
// isDefault = true — la que se acaba de marcar como predeterminada.
async function unsetOtherDefaults(userId, exceptId) {
  await prisma.address.updateMany({
    where: { userId, isDefault: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    data: { isDefault: false },
  })
}

// GET /api/addresses
addressesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    res.json(addresses.map(serializeAddress))
  }),
)

// POST /api/addresses
addressesRouter.post(
  '/',
  validate(createAddressSchema),
  asyncHandler(async (req, res) => {
    const { departamento, provincia, distrito, isDefault } = req.body || {}

    if (isDefault) await unsetOtherDefaults(req.user.id, null)

    const data = { userId: req.user.id, departamento, provincia, distrito, isDefault: Boolean(isDefault) }
    for (const field of EDITABLE_FIELDS) {
      if (field === 'departamento' || field === 'provincia' || field === 'distrito') continue
      data[field] = req.body?.[field] || null
    }

    const address = await prisma.address.create({ data })
    res.status(201).json(serializeAddress(address))
  }),
)

// PATCH /api/addresses/:id
addressesRouter.patch(
  '/:id',
  validate(updateAddressSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: 'Dirección no encontrada.' })
    }

    const data = {}
    for (const field of EDITABLE_FIELDS) {
      if (req.body?.[field] !== undefined) data[field] = req.body[field] || null
    }
    if (req.body?.isDefault !== undefined) {
      data.isDefault = Boolean(req.body.isDefault)
      if (data.isDefault) await unsetOtherDefaults(req.user.id, existing.id)
    }

    const address = await prisma.address.update({ where: { id: existing.id }, data })
    res.json(serializeAddress(address))
  }),
)

// DELETE /api/addresses/:id
addressesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: 'Dirección no encontrada.' })
    }
    await prisma.address.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  }),
)
