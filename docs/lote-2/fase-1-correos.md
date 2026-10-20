# Correos de pedido

ORDER_EMAILS_ENABLED está apagada si no vale exactamente true. Apagada no hay
worker ni llamadas al proveedor. La tabla conserva eventos nuevos aunque esté
apagada; no se importan estados históricos al migrar.

El trigger sobre el historial registra una fila por pedido y estado notificable.
No modifica pedidos, transiciones, cobros, usuarios, stock ni código POS.
El worker de la API atiende hasta 50 filas cada 30 segundos; puede ejecutarse
manualmente con node server/scripts/order-emails.mjs. El CLI no carga .env.

Reutiliza RESEND_API_KEY y EMAIL_FROM del servicio de correo existente. El dueño
debe aprobar el remitente. No habilitar ni programar nada en producción durante
esta entrega. Las pruebas inyectan un proveedor sintético sin conexiones externas.

## Idempotencia y errores

Clave estable por pedido/estado en la base y en Idempotency-Key del proveedor;
bloqueo por fila para concurrencia. Solo una respuesta real con id marca SENT.
El primer intento se persiste antes del envío, incluso si se pierde el COMMIT.
Los errores registran códigos fijos sin destinatarios, mensajes ni credenciales.
Los pedidos ya están confirmados antes de intentar el correo.

Reintentos automáticos solo durante 23 horas desde el primer intento. Después
queda REVIEW y requiere conciliación con el proveedor; no reiniciar la clave
ni borrar el registro de un resultado incierto. Para reactivar tras un periodo
apagado, revisar el backlog antes: se enviarán los estados en cola en orden
cronológico, incluidos los ocurridos mientras estaba apagado.

El correo enumera artículos, cantidades y total; no contiene sesiones, comprobantes
privados, dirección, teléfono, documento, QR, cuenta ni CCI. Las instrucciones de
pago se toman del método seleccionado y se eliminan enlaces y números largos.
El cliente consulta los datos completos en la tienda. Garantía y envío solo se
incluyen si están configurados en Datos comerciales.

## Publicación futura y recuperación

Con autorización por separado: respaldo, migración aditiva, Prisma Client, API.
No activar envíos hasta revisar remitente y cola. Ante incidente desactivar la
bandera y el job; conservar registros SENT/REVIEW. El código anterior admite
las tablas adicionales; no revertir físicamente ni borrar ventas o historial.

## Validación local realizada

Seis pruebas correctas: bandera apagada sin acceso a DB/proveedor, cinco estados,
duplicados y workers concurrentes, fallo después de aceptación con clave estable,
respuesta sin id, límite de reintento, privacidad/escape de plantillas y diff
Prisma sin deriva. Se usaron solo contenedor PostgreSQL local y proveedor inyectado.
