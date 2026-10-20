import { sendReviewInvitation } from './mailer.js'

export async function runReviewInvitations({ db, env = process.env, send = sendReviewInvitation, now = new Date() }) {
  if (env.REVIEW_INVITATIONS_ENABLED !== 'true') return { enabled: false, sent: 0 }
  const days = Number(env.REVIEW_INVITATION_DAYS || 7)
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('REVIEW_INVITATION_DAYS debe ser un entero de 1 a 90.')
  const origin = new URL(env.STORE_ORIGIN)
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('STORE_ORIGIN debe ser un origen HTTPS sin ruta.')
  const cutoff = new Date(now.getTime() - days * 86400000)
  // Bound batches. Never infer delivery time from order creation/updatedAt.
  // Exclude previously reviewed products before LIMIT, so repeat purchases
  // cannot permanently fill a batch and starve later eligible customers.
  const retryAfter = new Date(now.getTime() - 23 * 3600000)
  const candidates = await db.$queryRaw`
    SELECT oi.id FROM order_items oi
    JOIN orders o ON o.id=oi."orderId"
    JOIN users u ON u.id=o."userId"
    LEFT JOIN review_invitations invite ON invite."orderItemId"=oi.id
    WHERE o.status='DELIVERED' AND u.role='CUSTOMER' AND u.verified
      AND NOT u."isSuspended" AND u.email IS NOT NULL
      AND (invite.id IS NULL OR (invite."sentAt" IS NULL AND invite."startedAt">=${retryAfter}))
      AND (SELECT max(h."createdAt") FROM order_status_history h
           WHERE h."orderId"=o.id AND h.status='DELIVERED')<=${cutoff}
      AND NOT EXISTS (SELECT 1 FROM product_reviews r
                      WHERE r."userId"=u.id AND r."productId"=oi."productId")
    ORDER BY oi.id LIMIT 100`
  const lines = await db.orderItem.findMany({ where: { id:{in:candidates.map(row=>row.id)} },
    orderBy:{id:'asc'},include:{order:{include:{user:true}},product:{select:{slug:true}}} })
  let sent = 0
  for (const line of lines) {
    if (await db.productReview.findUnique({where:{userId_productId:{userId:line.order.userId,productId:line.productId}}})) continue
    // Persist the start before contacting the provider, so uncertainty never
    // causes automatic delivery beyond the provider's idempotency window.
    await db.reviewInvitation.createMany({data:[{orderItemId:line.id,startedAt:now}],skipDuplicates:true})
    const claim = await db.reviewInvitation.findUnique({where:{orderItemId:line.id}})
    if (claim.sentAt || now - claim.startedAt > 23 * 3600000) continue
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`review-invite:${line.id}`},0))`
      const current = await tx.reviewInvitation.findUnique({where:{orderItemId:line.id}})
      if (current.sentAt) return
      const order = await tx.order.findUnique({where:{id:line.orderId},include:{user:true}})
      if (order.status !== 'DELIVERED' || order.user?.role !== 'CUSTOMER' || order.user.isSuspended || !order.user.verified || !order.user.email) return
      const result = await send({to:order.user.email, productUrl:`${origin.origin}/producto/${encodeURIComponent(line.product.slug)}#resenas`,idempotencyKey:`review-invitation/${claim.id}`})
      if (typeof result?.id !== 'string' || !result.id) throw new Error('El proveedor no confirmó el envío con un identificador.')
      await tx.reviewInvitation.update({where:{id:claim.id},data:{sentAt:now,providerId:result.id}})
      sent++
    },{timeout:20000})
  }
  return {enabled:true,sent}
}
