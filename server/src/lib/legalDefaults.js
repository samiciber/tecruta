import { storeConfig } from '../../../src/config/storeConfig.js'
export const legalDefaults = {
  terminos: {
    title: 'Términos y condiciones',
    body: [
      `${storeConfig.name} es una tienda en línea que ofrece accesorios y tecnología para el mercado peruano. Al realizar un pedido, el cliente confirma sus datos de contacto y el detalle de los productos directamente por WhatsApp con nuestro equipo.`,
      'Los precios se muestran en soles (S/) e incluyen los impuestos aplicables. Los precios y el stock pueden cambiar sin previo aviso hasta que el pedido sea confirmado.',
      'La confirmación final de cada pedido, incluyendo el pago y la entrega, se coordina de forma manual por WhatsApp. Ningún pago se procesa automáticamente desde este sitio.',
      'El cliente es responsable de brindar información correcta sobre la dirección de entrega y los datos de contacto para coordinar el pedido.',
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    body: [
      `${storeConfig.name} respeta la privacidad de sus clientes. Para operar la tienda usamos un servidor y una base de datos propios, donde guardamos lo necesario para crear tu cuenta y gestionar tus pedidos: nombre, correo, contraseña (siempre cifrada, nunca en texto plano), dirección de entrega e historial de compras. No almacenamos datos de tarjetas ni procesamos pagos directamente en este sitio: cada pago se coordina de forma manual por WhatsApp.`,
      'Si compras como invitado (sin crear una cuenta), tu carrito se guarda únicamente en tu navegador (localStorage) y se pierde si cambias de dispositivo o borras los datos del sitio. Si inicias sesión, tu carrito también se guarda en nuestro servidor para que no lo pierdas entre dispositivos.',
      'Enviamos correos de verificación de cuenta y de recuperación de contraseña a través de un proveedor externo especializado en envío de correos (Resend). Ese proveedor procesa tu dirección de correo únicamente para entregarte esos mensajes.',
      'Los datos que el cliente comparte al coordinar un pedido (nombre, dirección, comprobante de pago) se envían directamente por WhatsApp y son gestionados también según las políticas de privacidad de esa plataforma.',
      'No compartimos información de clientes con terceros con fines publicitarios.',
      `Para consultas sobre privacidad, escríbenos a ${storeConfig.social.email}.`,
    ],
  },
}


for (const page of Object.values(legalDefaults)) page.body = page.body.join('\n\n')
legalDefaults.privacidad.body += '\n\nSi te suscribes a las novedades, guardamos tu correo y la fecha de registro de la suscripción. El formulario solicita tu aceptación y no envía correos de forma automática.'
