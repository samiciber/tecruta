import { sendReviewInvitation } from './mailer.js'

export async function runReviewInvitations({ db, env = process.env, send = sendReviewInvitation, now = new Date() }) {
  if (env.REVIEW_INVITATIONS_ENABLED !== 'true') return { enabled: false, sent: 0 }
  const days = Number(env.REVIEW_INVITATION_DAYS || 7)
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('REVIEW_INVITATION_DAYS debe ser un entero de 1 a 90.')
  const origin = new URL(env.STORE_ORIGIN)
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('STORE_ORIGIN debe ser un origen HTTPS sin ruta.')
  const cutoff = new Date(now.getTime() - days * 86400000)
  // Bound batches. Never infer delivery time from order creation/updatedAt.
  const lines = await db.orderItem.findMany({ where: { review: null, order: { status: 'DELIVERED', user: { role:'CUSTOMER',verified:true,isSuspended:false,email:{not:null} }, statusHistory: { some: { status:'DELIVERED',createdAt:{lte:cutoff} } } },
    OR: [{reviewInvitation:null},{reviewInvitation:{sentAt:null,startedAt:{gte:new Date(now.getTime()-23*3600000)}}}] },
    orderBy:{id:'asc'},take:100,include:{order:{include:{user:true,statusHistory:{where:{status:'DELIVERED'},orderBy:{createdAt:'desc'},take:1}}},product:{select:{slug:true}}} })
  let sent = 0
  for (const line of lines) {
    if (line.order.statusHistory[0]?.createdAt > cutoff) continue
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
      await tx.reviewInvitation.update({where:{id:claim.id},data:{sentAt:now,providerId:result.id}})
      sent++
    },{timeout:20000})
  }
  return {enabled:true,sent}
}
