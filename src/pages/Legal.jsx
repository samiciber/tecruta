import React from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { storeConfig } from '../config/storeConfig.js'

const CONTENT = {
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

export default function Legal() {
  const { type } = useParams()
  const content = CONTENT[type]

  if (!content) return <Navigate to="/" replace />

  return (
    <div className="container-tr max-w-2xl py-12">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">{content.title}</h1>
      <div className="flex flex-col gap-4">
        {content.body.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-ink-soft dark:text-paper/60">
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}
