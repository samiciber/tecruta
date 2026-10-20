import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
export const telemetryRouter = Router()
telemetryRouter.use(rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes.' } }))
telemetryRouter.post('/errors', (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (process.env.FRONTEND_ERROR_MONITOR_DSN) {
    const name = typeof req.body?.category === 'string' ? req.body.category : 'Error'
    void import('../optional/errorMonitor.js').then(module => module.reportError({ name }, { source: 'frontend', dsn: process.env.FRONTEND_ERROR_MONITOR_DSN })).catch(() => {})
  }
  res.sendStatus(204)
})
telemetryRouter.post('/analytics', (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (process.env.PLAUSIBLE_DOMAIN && process.env.PLAUSIBLE_ENDPOINT) {
    const name = typeof req.body?.name === 'string' ? req.body.name : ''
    void import('../optional/analytics.js').then(module => module.reportAnalytics(name)).catch(() => {})
  }
  res.sendStatus(204)
})
