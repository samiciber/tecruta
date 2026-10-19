# Publicación de interfaz — 19 de octubre de 2026

Autorización del titular: «publicalo despues me dices que esta pendiente».

Se publicó la revisión funcional 3043703f14456314fa254c4fbb4a0b58084c7dfc en main. Incluye navegación por tareas, recuperación del carrito y reintentos de cobro, atajos, formularios secundarios plegados y menú lateral de Más con fijación opcional.

## Sitios verificados

- Panel: https://tecruta-panel.vercel.app/iniciar-sesion
- Tienda: https://www.tecruta.com
- API: https://tecruta.onrender.com

| Servicio | Despliegue funcional | Estado |
| --- | --- | --- |
| Panel Vercel | DpscuahazJCzNuyW6fT28qkT4dh2 | Producción, listo; 3043703 |
| Tienda Vercel | CTx3eeXCEiY7iUje3vYgKzBE22Kq | Producción, listo; 3043703 |
| API Render | Sin despliegue en esta publicación | Health OK; conserva 972628a |

Publicación comprobada alrededor de las 09:04, America/Lima. La actualización documental posterior conserva exactamente el mismo código funcional.

No se ejecutaron migraciones, seeds, cambios de cuentas, ventas, cobros ni movimientos de prueba en producción. No hubo pausa de API ni cambios de DNS. Se conservaron los proyectos, dominios y configuración de compilación de Vercel.

## Comprobaciones

- Ambos builds locales correctos y git diff --check.
- Evidencias sintéticas anteriores: 10 grupos de navegación/interfaz, 15 de POS, 11 de inventario, 6 de personal y 8 de recuperación. PostgreSQL local desechable.
- En producción: HTTP 200 en tienda/panel/API y recursos nuevos del menú lateral y recuperación disponibles.
- Login del panel visible; no se introdujeron credenciales ni se alteró la cuenta del titular. La revisión completa autenticada del nuevo flujo se hizo en el entorno sintético; no se generaron operaciones reales para comprobarlo.
- Inventario, personal y caja devuelven 401 sin sesión; CORS admite los dos orígenes concretos y rechaza example.com.
- Panel conserva noindex/nofollow/noarchive.
- Tienda pública conserva catálogo y no incorpora pantallas administrativas.

Evidencias: [verificación técnica](publicacion-20261019/verificacion.json), [recursos HTTP](publicacion-20261019/http-assets.json), [panel en Vercel](publicacion-20261019/panel-vercel.png), [tienda en Vercel](publicacion-20261019/tienda-vercel.png), [acceso al panel](publicacion-20261019/panel-publicado.png).

## Pendientes

Las mejoras de interfaz quedan publicadas. Pendientes externos conocidos:

1. Configurar DNS y dominio admin.tecruta.com; la consulta del 19 de octubre devolvió ENOTFOUND. Se conserva la URL actual de Vercel.
2. Proveedor y configuración reales para comprobantes electrónicos SUNAT. El ticket interno sigue sin valor fiscal.
3. Prueba física de lectora USB e impresora térmica en los equipos de la tienda.
4. Comprobar con el titular la recepción real del correo de recuperación. Esta publicación no envió correos.

Los usuarios reales y la doble autenticación del titular se administran desde Personal y Seguridad; no se completan por él ni se cambian sus credenciales durante un despliegue.

## Recuperación

Para un fallo del frontend, corregir hacia adelante o utilizar un despliegue compatible preservando el mecanismo de recuperación de cobros. No borrar claves de intentos pendientes del navegador ni crear una venta nueva para repetir un resultado incierto: usar Recuperar mismo intento. No volver a la API anterior al Kardex ni restaurar un respaldo sobre ventas posteriores.

Los anteriores despliegues de frontend se conservan en Vercel; revisar operaciones pendientes antes de una reversión. Esta publicación no cambió el esquema ni requiere restaurar PostgreSQL.
