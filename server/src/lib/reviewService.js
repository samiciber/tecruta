import { AuthError } from './authSecurity.js'
import { audit } from './staffSecurity.js'

const fail = (status, message) => { throw new AuthError(status, message) }
export const reviewPublicName = user => `${user.nombre.trim()}${user.apellido.trim() ? ` ${Array.from(user.apellido.trim())[0]}.` : ''}`
export function publicReview(row) {
  return { id: row.id, rating: row.rating, title: row.title, text: row.text,
    name: reviewPublicName(row.user), verifiedPurchase: true,
    helpfulCount: row.helpfulCount, storeReply: row.storeReply, repliedAt: row.repliedAt, createdAt: row.createdAt }
}
export const publicAuthor = { select: { nombre: true, apellido: true } }
async function lockProduct(tx, id) {
  const rows = await tx.$queryRaw`SELECT id FROM products WHERE id=${id} FOR UPDATE`
  if (!rows.length) fail(404, 'Producto no encontrado.')
}
async function authorize(tx, userId, role) {
  const rows = await tx.$queryRaw`SELECT id, role, verified, "isSuspended", "mustChangePassword" FROM users WHERE id=${userId} FOR SHARE`
  const user = rows[0]
  if (!user || user.role !== role || user.isSuspended || user.mustChangePassword || (role === 'CUSTOMER' && !user.verified)) fail(403, 'No tienes permisos para esta acción.')
}
export async function reviewEligibility(db, productId, user) {
  if (user.role !== 'CUSTOMER') return { eligible: false, reason: 'STAFF', message: 'Las reseñas están reservadas a clientes con compra entregada.' }
  if (!user.verified) return { eligible: false, reason: 'UNVERIFIED', message: 'Verifica tu correo antes de opinar.' }
  const existing = await db.productReview.findUnique({ where: { userId_productId: { userId: user.id, productId } }, select: { status: true } })
  if (existing) return { eligible: false, reason: 'ALREADY_REVIEWED', status: existing.status, message: `Ya enviaste tu reseña (${({PENDING:'pendiente de revisión',APPROVED:'publicada',REJECTED:'no publicada'})[existing.status]}).` }
  const line = await db.orderItem.findFirst({ where: { productId, order: { userId: user.id, status: 'DELIVERED' } }, orderBy: { id: 'asc' }, select: { id: true } })
  return line ? { eligible: true, orderItemId: line.id } : { eligible: false, reason: 'NO_DELIVERED_PURCHASE', message: 'Podrás opinar cuando recibas un pedido de este producto comprado con tu cuenta.' }
}
export async function createReview(db, productId, userId, body) {
  return db.$transaction(async tx => {
    await authorize(tx, userId, 'CUSTOMER')
    const line = await tx.orderItem.findUnique({ where: { id: body.orderItemId } })
    if (!line || line.productId !== productId) fail(403, 'Necesitas una compra entregada de este producto.')
    const orders = await tx.$queryRaw`SELECT id, status, "userId" FROM orders WHERE id=${line.orderId} FOR SHARE`
    if (orders[0]?.userId !== userId || orders[0]?.status !== 'DELIVERED') fail(403, 'Necesitas una compra entregada de este producto.')
    // Same order -> product lock order used by web order transitions.
    await lockProduct(tx, productId)
    if (await tx.productReview.findUnique({ where: { userId_productId: { userId, productId } } })) fail(409, 'Ya enviaste una reseña de este producto.')
    const row = await tx.productReview.create({ data: { productId, userId, orderItemId: line.id, rating: body.rating, title: body.title || null, text: body.text } })
    return { id: row.id, status: row.status }
  })
}
export async function moderateReview(db, reviewId, actorId, body) {
  return db.$transaction(async tx => {
    await authorize(tx, actorId, 'ADMIN')
    const target = await tx.productReview.findUnique({ where: { id: reviewId }, select: { productId: true } })
    if (!target) fail(404, 'Reseña no encontrada.')
    await lockProduct(tx, target.productId)
    const row = await tx.productReview.findUnique({ where: { id: reviewId } })
    const status = body.status || row.status
    const delta = Number(status === 'APPROVED') - Number(row.status === 'APPROVED')
    if (delta) await tx.product.update({ where: { id: row.productId }, data: { ratingCount: { increment: delta }, ratingSum: { increment: delta * row.rating } } })
    const updated = await tx.productReview.update({ where: { id: reviewId }, data: {
      status, ...(body.status ? { rejectionReason: status === 'REJECTED' ? body.rejectionReason : null } : {}),
      ...(body.storeReply !== undefined ? { storeReply: body.storeReply || null, repliedAt: new Date() } : {}),
      moderatedById: actorId, moderatedAt: new Date(),
    } })
    await audit(tx, actorId, 'REVIEW_MODERATED', reviewId, { before: row.status, after: status, replyChanged: body.storeReply !== undefined, productId: row.productId,
      ...(body.status === 'REJECTED' ? { rejectionReason: body.rejectionReason } : {}),
      ...(body.storeReply !== undefined ? { storeReply: body.storeReply || null } : {}),
    })
    return { id: updated.id, status: updated.status }
  })
}
export async function voteReviewHelpful(db, reviewId, userId) {
  return db.$transaction(async tx => {
    await authorize(tx, userId, 'CUSTOMER')
    const rows = await tx.$queryRaw`SELECT id, status, "userId" FROM product_reviews WHERE id=${reviewId} FOR UPDATE`
    const review = rows[0]
    if (!review || review.status !== 'APPROVED') fail(404, 'Reseña no encontrada.')
    if (review.userId === userId) fail(403, 'No puedes votar tu propia reseña.')
    const existing = await tx.reviewHelpfulVote.findUnique({ where: { reviewId_userId: { reviewId, userId } } })
    if (!existing) {
      await tx.reviewHelpfulVote.create({ data: { reviewId, userId } })
      await tx.productReview.update({ where: { id: reviewId }, data: { helpfulCount: { increment: 1 } } })
    }
    const row = await tx.productReview.findUnique({ where: { id: reviewId }, select: { helpfulCount: true } })
    return { ...row, voted: true }
  })
}

function cursorWhere(cursor, context) {
  if (!cursor) return {}
  let value
  try { value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) } catch { fail(400, 'Cursor inválido.') }
  if (!value || value.context !== context || typeof value.id !== 'string' || value.id.length > 100 || !Number.isFinite(Date.parse(value.date)) || !Number.isSafeInteger(value.helpful) || value.helpful < 0) fail(400, 'Cursor inválido.')
  const date = new Date(value.date)
  const recent = [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: value.id } }]
  return context.startsWith('helpful:') ? { OR: [{ helpfulCount: { lt: value.helpful } }, { helpfulCount: value.helpful, OR: recent }] } : { OR: recent }
}
export async function listPublicReviews(db, productId, query) {
  const context = `${query.sort}:${productId}:${query.rating || ''}`
  const after = cursorWhere(query.cursor, context)
  return db.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { ratingCount: true, ratingSum: true } })
    if (!product) fail(404, 'Producto no encontrado.')
    const distribution = await tx.productReview.groupBy({ by: ['rating'], where: { productId, status: 'APPROVED' }, _count: { _all: true } })
    const rows = await tx.productReview.findMany({ where: { productId, status: 'APPROVED', ...(query.rating ? { rating: query.rating } : {}), ...after },
      orderBy: [...(query.sort === 'helpful' ? [{ helpfulCount: 'desc' }] : []), { createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1, include: { user: publicAuthor } })
    const items = rows.slice(0, query.limit), last = items.at(-1)
    return { items: items.map(publicReview), nextCursor: rows.length > query.limit ? Buffer.from(JSON.stringify({ context, id: last.id, date: last.createdAt.toISOString(), helpful: last.helpfulCount })).toString('base64url') : null,
      summary: { count: product.ratingCount, sum: product.ratingSum, average: product.ratingCount ? product.ratingSum / product.ratingCount : null,
        distribution: [5,4,3,2,1].map(rating => ({ rating, count: distribution.find(row => row.rating === rating)?._count._all || 0 })) } }
  }, { isolationLevel: 'RepeatableRead' })
}
