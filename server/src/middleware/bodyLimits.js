import express from 'express'

const normalJson = express.json({ limit: '100kb' })
// Bypass only exact POST upload routes. Their routers authorize before parsing.
export function defaultJson(req, res, next) {
  const upload = req.method === 'POST' && (/^\/api\/orders\/[^/]+\/receipt\/?$/.test(req.path)
    || /^\/api\/admin\/uploads(?:\/model)?\/?$/.test(req.path))
  return upload ? next() : normalJson(req, res, next)
}
export const imageJson = express.json({ limit: '7mb' })
export const receiptJson = express.json({ limit: '12mb' })
export const modelJson = express.json({ limit: '21mb' })
