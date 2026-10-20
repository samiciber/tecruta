import { sendOrderStatusEmail } from './mailer.js'

const RETRY_WINDOW = 23 * 60 * 60 * 1000
export const orderEmailsEnabled = () => process.env.ORDER_EMAILS_ENABLED === 'true'

// The row is committed by the history trigger before a provider is contacted.
// An uncertain provider result never touches order, payment or stock.
export async function processOrderEmails({ db, send = sendOrderStatusEmail, now = () => new Date(), enabled = orderEmailsEnabled() }) {
  if (!enabled) return { enabled: false, sent: 0, failed: 0, review: 0 }
  const result = { enabled: true, sent: 0, failed: 0, review: 0 }
  const rows = await db.orderEmailDelivery.findMany({
    where: { state: 'PENDING' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 50,
  })
  for (const candidate of rows) {
    const clock = now()
    // Persist outside the network transaction: even a lost COMMIT must not reset
    // the provider's limited idempotency window on the next process invocation.
    await db.orderEmailDelivery.updateMany({
      where: { id: candidate.id, firstAttemptAt: null, state: 'PENDING' },
      data: { firstAttemptAt: clock },
    })
    const outcome = await db.$transaction(async tx => {
      const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtextextended(${candidate.id},0)) AS locked`
      if (!lock.locked) return 'busy'
      const row = await tx.orderEmailDelivery.findUnique({ where: { id: candidate.id } })
      if (row.state !== 'PENDING') return 'busy'
      if (clock - row.firstAttemptAt >= RETRY_WINDOW) {
        await tx.orderEmailDelivery.update({ where: { id: row.id }, data: { state: 'REVIEW', lastErrorCode: 'RETRY_WINDOW_EXPIRED' } })
        return 'review'
      }
      const order = await tx.order.findUnique({
        where: { id: row.orderId }, include: { items: true, paymentMethod: true },
      })
      const business = await tx.siteSetting.findUnique({ where: { key: 'storeBusiness' } })
      try {
        const response = await send({ order, status: row.status, business: business?.value || {}, idempotencyKey: row.id })
        if (typeof response?.id !== 'string' || !response.id.trim()) throw new Error('Uncertain provider result')
        await tx.orderEmailDelivery.update({ where: { id: row.id }, data: {
          state: 'SENT', sentAt: clock, providerId: response.id, attempts: { increment: 1 }, lastAttemptAt: clock, lastErrorCode: null,
        } })
        return 'sent'
      } catch {
        // Store a fixed code only: provider errors can contain recipients or keys.
        await tx.orderEmailDelivery.update({ where: { id: row.id }, data: {
          attempts: { increment: 1 }, lastAttemptAt: clock, lastErrorCode: 'PROVIDER_UNCONFIRMED',
        } })
        return 'failed'
      }
    }, { maxWait: 5000, timeout: 20000 })
    if (outcome !== 'busy') result[outcome]++
  }
  return result
}

export function startOrderEmailWorker({ db }) {
  if (!orderEmailsEnabled()) return () => {}
  let running = false
  const tick = async () => {
    if (running || !orderEmailsEnabled()) return
    running = true
    try { await processOrderEmails({ db }) }
    catch { console.error('ORDER_EMAIL_WORKER_FAILED') }
    finally { running = false }
  }
  const timer = setInterval(tick, 30000)
  timer.unref()
  void tick()
  return () => clearInterval(timer)
}
