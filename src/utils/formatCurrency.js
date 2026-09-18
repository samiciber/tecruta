import { storeConfig } from '../config/storeConfig.js'

export function formatCurrency(amount) {
  const value = Number.isFinite(amount) ? amount : 0
  return `${storeConfig.currencySymbol} ${value.toLocaleString(storeConfig.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function calculateDiscountPercent(price, compareAtPrice) {
  if (!compareAtPrice || compareAtPrice <= price) return 0
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}
