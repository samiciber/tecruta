// Importes en céntimos enteros, compartidos por API y POS. Nunca redondea floats.
export function cents(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) throw new Error('Usa un importe decimal positivo con hasta dos decimales.')
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export function amount(value) {
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}
export function returnCents(lineTotal, sold, alreadyReturned, quantity) {
  if (![sold, alreadyReturned, quantity].every(Number.isSafeInteger) || sold <= 0 || alreadyReturned < 0 || quantity < 0 || alreadyReturned + quantity > sold) throw new Error('Cantidad de devolución inválida.')
  const net = cents(String(lineTotal))
  return net * BigInt(alreadyReturned + quantity) / BigInt(sold) - net * BigInt(alreadyReturned) / BigInt(sold)
}
