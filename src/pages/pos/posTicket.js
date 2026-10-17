const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
export const methodLabel = { cashOnDelivery: 'Efectivo', yape: 'Yape', plin: 'Plin', bankTransfer: 'Transferencia' }
export function printPosTicket(sale) {
  if (!sale.confirmedAt) throw new Error('Una venta pendiente todavía no tiene ticket de cobro.')
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('Permite ventanas emergentes para imprimir el ticket.')
  popup.opener = null
  const money = value => `S/ ${Number(value).toFixed(2)}`
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket interno ${escape(sale.id)}</title><style>
    @page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:72mm;margin:0 auto;font:11px monospace;color:#000;background:#fff}h1{font:700 22px Arial;margin:10px 0 3px}h2{font-size:13px}p{overflow-wrap:anywhere}header,footer{text-align:center}table{width:100%;border-collapse:collapse}td{padding:5px 0;vertical-align:top}.right{text-align:right;white-space:nowrap}.line{border-top:1px dashed #000;margin-top:10px;padding-top:8px}.total{font-size:17px;font-weight:bold}.muted{font-size:10px}button{margin:15px}@media print{button{display:none}}
    </style></head><body><header><h1>TecRuta</h1><h2>TICKET INTERNO</h2><p><strong>NO ES BOLETA NI FACTURA<br>ELECTRÓNICA SUNAT</strong></p></header>
    <p>N.º ${escape(sale.id)}<br>${escape(new Date(sale.confirmedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' }))}<br>Cajero: ${escape(sale.user.nombre)} ${escape(sale.user.apellido)}<br>Estado: ${escape({ CONFIRMED: 'Confirmada', RETURNED: 'Devuelta', VOIDED: 'Anulada' }[sale.status] || sale.status)}</p>
    <p>Cliente: ${escape(sale.customerName || 'Consumidor final')}${sale.customerDocument ? `<br>Documento: ${escape(sale.customerDocument)}` : ''}${sale.orderId ? `<br>Pedido web: ${escape(sale.orderId)}` : ''}</p>
    <table class="line">${sale.items.map(line => `<tr><td>${escape(line.name)}<br><span class="muted">${escape(line.sku)}<br>${line.quantity} × ${money(line.unitPrice)}</span></td><td class="right">${money(line.lineTotal)}</td></tr>`).join('')}</table>
    <table class="line"><tr><td>Subtotal</td><td class="right">${money(sale.subtotal)}</td></tr><tr><td>Descuento</td><td class="right">${money(sale.discount)}</td></tr><tr class="total"><td>TOTAL</td><td class="right">${money(sale.total)}</td></tr></table>
    ${sale.payments.map(payment => `<p>${escape(methodLabel[payment.method] || payment.method)}: ${money(payment.amount)}<br>Recibido: ${money(payment.received)} · Vuelto: ${money(payment.change)}${payment.reference ? `<br>Ref.: ${escape(payment.reference)}` : ''}</p>`).join('')}
    ${sale.refunds.length ? `<div class="line"><strong>DEVOLUCIONES / ANULACIONES</strong>${sale.refunds.map(refund => `<p>${money(refund.amount)} · ${escape(methodLabel[refund.method])}<br>${escape(refund.reason)}<br>Ref.: ${escape(refund.id)}</p>`).join('')}</div>` : ''}
    <footer class="line"><p>Conserva este ticket para consultas.<br>Gracias por tu compra.</p><p class="muted">Documento de control interno.<br>Sin emisión fiscal desde este POS.</p><button onclick="window.print()">Imprimir ticket</button></footer></body></html>`)
  popup.document.close()
  return popup
}
