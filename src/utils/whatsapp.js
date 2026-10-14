import { storeConfig } from '../config/storeConfig.js'
import { formatCurrency } from './formatCurrency.js'

// Los emojis se definen como escapes Unicode (\u{...}) en vez de pegar el
// glifo directamente en el código. Esto evita que se corrompan (aparezcan
// como "�") si el archivo se guarda con una codificación distinta a UTF-8
// en algún editor — el escape es texto ASCII puro y siempre se interpreta
// igual sin importar la codificación del archivo.
const EMOJI = {
  cliente: '\u{1F464}', // 👤
  correo: '\u{1F4E7}', // 📧
  celular: '\u{1F4F1}', // 📱
  productos: '\u{1F4E6}', // 📦
  subtotal: '\u{1F4CA}', // 📊
  ahorro: '\u{1F49A}', // 💚
  total: '\u{1F4B0}', // 💰
  entrega: '\u{1F69A}', // 🚚
  ubicacion: '\u{1F4CD}', // 📍
  direccion: '\u{1F3E0}', // 🏠
  referencia: '\u{1F4CC}', // 📌
  comprobante: '\u{1F4C4}', // 📄
  recibe: '\u{1F64B}', // 🙋
  pago: '\u{1F4B3}', // 💳
  carrito: '\u{1F6D2}', // 🛒
}

// Arma las líneas de detalle del método de pago elegido, a partir del
// objeto { key, label, config } ya resuelto por usePaymentMethods() —
// la misma fuente (API real, o el respaldo estático si la API no
// respondió) que se mostró en el selector del checkout. Así el mensaje
// de WhatsApp siempre coincide con lo que el cliente vio en pantalla,
// incluso si el admin cambió el número de Yape o la cuenta bancaria
// desde el panel.
function buildPaymentLines(paymentMethodDetails) {
  if (!paymentMethodDetails) return []
  const { key, label, config = {} } = paymentMethodDetails

  const lines = [`${EMOJI.pago} Método de pago: ${label}`]

  if (key === 'yape' || key === 'plin') {
    lines.push(`Número de ${label}: ${config.phoneNumber}`)
    lines.push(`Titular: ${config.holderName}`)
    if (config.qrImageUrl) lines.push(`También puede pagar escaneando el QR de ${label} que te enviaremos.`)
    return lines
  }

  if (key === 'bankTransfer') {
    lines.push(`Banco: ${config.bankName}`)
    lines.push(`Titular: ${config.holderName}`)
    lines.push(`Cuenta: ${config.accountNumber}`)
    lines.push(`CCI: ${config.cci}`)
    return lines
  }

  // cashOnDelivery (u otro método futuro sin datos adicionales): solo la
  // línea de "Método de pago".
  return lines
}

// Construye el mensaje de pedido y el enlace de WhatsApp a partir del
// carrito, los datos del cliente, la dirección de entrega y el método de
// pago elegidos en el checkout.
export function buildWhatsAppOrderLink(items, { customer, delivery, paymentMethodDetails, confirmedOrder } = {}) {
  const lines = []
  lines.push(`Hola, ${storeConfig.name}. Quiero realizar este pedido:`)
  if (confirmedOrder) lines.push(`Pedido registrado: ${confirmedOrder.id}`)
  lines.push('')

  // Cliente
  if (customer?.nombre || customer?.apellido) {
    lines.push(`${EMOJI.cliente} Cliente: ${[customer.nombre, customer.apellido].filter(Boolean).join(' ')}`)
  }
  if (customer?.correo) lines.push(`${EMOJI.correo} Correo: ${customer.correo}`)
  if (customer?.celular) lines.push(`${EMOJI.celular} Celular: ${customer.celular}`)

  // Productos
  lines.push('')
  lines.push(`${EMOJI.productos} Productos:`)
  items.forEach((item) => {
    const lineTotal = item.price * item.quantity
    lines.push(`${item.quantity}x ${item.name} — ${formatCurrency(lineTotal)}`)
  })

  const subtotal = confirmedOrder?.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const savings = confirmedOrder?.savings ?? items.reduce((sum, item) => {
    if (!item.compareAtPrice || item.compareAtPrice <= item.price) return sum
    return sum + (item.compareAtPrice - item.price) * item.quantity
  }, 0)

  lines.push('')
  lines.push(`${EMOJI.subtotal} Subtotal: ${formatCurrency(subtotal)}`)
  if (savings > 0) lines.push(`${EMOJI.ahorro} Ahorro total: ${formatCurrency(savings)}`)
  lines.push(`${EMOJI.total} Total: ${formatCurrency(confirmedOrder?.total ?? subtotal)} (envío se coordina según destino)`)

  // Entrega
  if (delivery) {
    lines.push('')
    lines.push(`${EMOJI.entrega} Método de entrega: ${delivery.tipoEntrega === 'recojo' ? 'Punto de recojo' : 'Envío a domicilio'}`)

    const ubicacion = [delivery.distrito, delivery.provincia, delivery.departamento].filter(Boolean).join(', ')
    if (ubicacion) lines.push(`${EMOJI.ubicacion} Ubicación: ${ubicacion}`)

    if (delivery.tipoEntrega !== 'recojo') {
      const direccionCompleta = [
        [delivery.direccion, delivery.numero].filter(Boolean).join(' ').trim(),
        delivery.interior,
      ]
        .filter(Boolean)
        .join(', ')
      if (direccionCompleta) lines.push(`${EMOJI.direccion} Dirección: ${direccionCompleta}`)
      if (delivery.referencia) lines.push(`${EMOJI.referencia} Referencia: ${delivery.referencia}`)
    }

    if (delivery.quiereComprobante) {
      lines.push(`${EMOJI.comprobante} Comprobante: Boleta/Factura${delivery.documento ? ` — Doc: ${delivery.documento}` : ''}`)
    }
    if (delivery.otraPersona && (delivery.personaNombre || delivery.personaCelular)) {
      lines.push(`${EMOJI.recibe} Recibe: ${[delivery.personaNombre, delivery.personaCelular].filter(Boolean).join(' — ')}`)
    }
  }

  // Pago
  const paymentLines = buildPaymentLines(paymentMethodDetails)
  if (paymentLines.length > 0) {
    lines.push('')
    lines.push(...paymentLines)
  }

  lines.push('')
  lines.push(`${EMOJI.carrito} Quisiera coordinar el pago y entrega.`)

  const message = lines.join('\n')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${storeConfig.whatsapp.number}?text=${encoded}`
}
// Uses only the confirmed API snapshot; never cached cart prices/payment config.
export function buildConfirmedWhatsAppLink(order) {
  return buildWhatsAppOrderLink(order.items.map(item => ({ ...item, price: item.unitPrice })), {
    confirmedOrder: order,
    customer: { nombre: order.customerNombre, apellido: order.customerApellido, correo: order.customerCorreo, celular: order.customerCelular },
    delivery: { ...order, tipoEntrega: order.deliveryType === 'PICKUP' ? 'recojo' : 'envio' },
    paymentMethodDetails: order.paymentMethodLabel ? { label: order.paymentMethodLabel } : undefined,
  })
}
