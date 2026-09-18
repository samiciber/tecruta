// Configuración central de métodos de pago.
// Reemplaza estos valores por los datos reales de la tienda.
// Ningún componente del checkout tiene estos datos escritos directamente:
// todos los leen desde aquí, así que basta editar este archivo para actualizarlos.

export const paymentConfig = {
  yape: {
    enabled: true,
    label: 'Yape',
    holderName: 'Marcos Samuel Fabian Salas',
    phoneNumber: '919 147 293',
    // Coloca aquí la URL de tu imagen QR (por ejemplo, subida a /public) cuando la tengas.
    qrImageUrl: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787240943/qr-yape.png',
    instructions: 'Escanea el QR o yapea al número indicado. Envía la captura del pago en el siguiente paso.',
  },
  plin: {
    enabled: true,
    label: 'Plin',
    holderName: 'Marcos Samuel Fabian Salas',
    phoneNumber: '919 147 293',
    qrImageUrl: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787240943/qr-yape.png',
    instructions: 'Escanea el QR o realiza el Plin al número indicado. Envía la captura del pago en el siguiente paso.',
  },
  bankTransfer: {
  enabled: true,
  label: 'Transferencia bancaria',
  bankName: 'BCP',
  holderName: 'Marcos Samuel Fabian Salas',
  accountNumber: '570-90661017-0-38',
  cci: '002-570-190661017038-00',
  instructions: 'Realiza la transferencia y envía el comprobante en el siguiente paso para confirmar tu pedido.',
},
  cashOnDelivery: {
    enabled: true,
    label: 'Efectivo / contra entrega',
    availableFor: ['Lima Metropolitana'],
    instructions:
      'Pago en efectivo al momento de recibir tu pedido. Disponible solo para zonas de Lima con delivery coordinado.',
  },
}
