import { API_URL } from '../services/api.js'
const categories = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError'])
export function errorCategory(error) { return categories.has(error?.name) ? error.name : 'Error' }
export function startErrors({ target = window, send = fetch } = {}) {
  let count = 0
  const report = error => {
    if (count++ >= 10) return
    void send(API_URL + '/api/telemetry/errors', {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: errorCategory(error) }),
      signal: AbortSignal.timeout(2500),
    }).catch(() => {})
  }
  const onError = event => report(event.error)
  const onRejection = event => report(event.reason)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => { target.removeEventListener('error', onError); target.removeEventListener('unhandledrejection', onRejection) }
}
