import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { serializeCategory } from '../lib/serializers.js'
import { asyncHandler } from '../middleware/errorHandler.js'

export const categoriesRouter = Router()

// GET /api/categories
categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    res.json(categories.map(serializeCategory))
  }),
)