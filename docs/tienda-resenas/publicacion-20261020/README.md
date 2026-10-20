# Publicación realizada — 20 de octubre de 2026

Autorización del titular: «esta bien publica todo segun el prompt pasado». Se publicaron rediseño, reseñas verificadas, moderación ADMIN, datos comerciales configurables y opiniones compactas con Ver/Ocultar y tres comentarios por lote.

## Versiones verificadas

| Servicio | Revisión | Despliegue | Estado |
|---|---|---|---|
| API Render | 55aa0a6a2c7ead4b4f0a9333a40a4ea59e735388 | dep-dbbh6nu7bikc738id2q0 | Live, 02:09 America/Lima |
| Tienda Vercel | 55aa0a6 | ENBknKLWvS5TzbXRuwYEgTgCs2LU | Ready, Production, 02:11 |
| Panel Vercel | 55aa0a6 | 5CKZB28yGDzDSVSmEiSTeZVkrZEp | Ready, Production |

- Tienda: https://www.tecruta.com
- Panel: https://tecruta-panel.vercel.app
- Moderación: https://tecruta-panel.vercel.app/resenas (ADMIN).
- Configuración: https://tecruta-panel.vercel.app/datos-comerciales (ADMIN).
- Código: rama feature/rediseno-tienda-resenas en GitHub. No hubo merge ni push a main. Los commits posteriores de evidencia y transporte de pruebas no cambian el código funcional desplegado.

## Migración y recuperación

Neon creó previamente la instantánea manual `production at 2026-10-20 07:04:32 UTC (manual)`, visible sin caducidad. No se restauró sobre producción ni se trasladaron datos reales al QA. Render ejecutó `prisma migrate deploy` con su conexión existente: aplicó exclusivamente `20261020000000_product_reviews` a las 02:08:31–32 America/Lima y regeneró Prisma Client 5.22.0. No se editaron migraciones anteriores ni credenciales. El build temporal se restauró a `npm ci && npx prisma generate`; autodeploy permanece desactivado en Render.

Consulta final de lectura en Neon: migración terminada, sin rollback, cero migraciones fallidas, cero reseñas/votos/invitaciones y cero diferencias entre contadores y reseñas aprobadas. Las opiniones de prueba permanecen solo en la base QA.

Para recuperación funcional, usar la API anterior `dep-dbakj1e1egvs73b2sdn0`, tienda `EpNwLYN7mpD8HCvQQJ5tTpjZfvHU` y panel `FYnGyPPbSkDMoRBCEKLagsJ8WnqH`. Conservar tablas y registros de reseñas; no restaurar una instantánea sobre ventas posteriores ni borrar movimientos. Si se añadió un bloque CMS reviews, retirarlo desde el panel compatible antes de volver a la API antigua. Ver [procedimiento](../publicacion-recuperacion.md).

## Comprobaciones

- 63/63 pruebas vigentes en PostgreSQL local desechable; ambos builds y diff --check correctos. Una repetición para corregir la codificación del log detectó `fetch failed` después de la prueba de migración síncrona y cuatro fallos dependientes. Se conserva el [registro intermitente](../validacion/prepublicacion-intermitente.log). El transporte de la suite de personal ahora cierra cada conexión HTTP para evitar reutilizar un socket keep-alive vencido durante el bloqueo síncrono; no se cambió ninguna aserción ni código de producción. La [última ejecución completa](../validacion/prepublicacion.log) pasó las mismas 63 pruebas, sin omitidas.
- API health 200 y revisión exacta; catálogo 200 con 149 productos y campos de calificación; reseñas vacías y resumen cero sin estrellas inventadas.
- Moderación, personal, inventario y POS sin sesión: 401. CORS devuelve únicamente el origen autorizado de tienda o panel; example.com no recibe Access-Control-Allow-Origin.
- Tienda y panel 200, recursos JS nuevos apuntan a la API correcta; panel conserva noindex. Navegador: portada con CMS real y pagos configurados; /resenas redirige al login si falta sesión.
- No se introdujeron contraseñas ni se crearon compras, cobros o reseñas ficticias en producción. Las pruebas y seeds se ejecutaron solo en PostgreSQL local desechable. Las lecturas finales son comprobaciones operativas del despliegue.

## Pendientes y límites

La batería histórica completa conserva los mismos 57 fallos que main, detallados en [comparación](../validacion/comparacion.json). No se declara toda esa batería correcta. Los cinco avisos altos anteriores de dependencias de desarrollo continúan; no se añadieron dependencias ni se cambiaron versiones.

El dueño debe completar o confirmar razón social, RUC, dirección, URL del Libro de Reclamaciones, garantía y envíos en Datos comerciales; los vacíos se ocultan. Las invitaciones siguen apagadas, sin job programado. Activarlas solo tras aprobar remitente, contenido y frecuencia. La moderación de reseñas reales queda a cargo del ADMIN. La portada exige al menos tres aprobadas.

No hubo cambio de dominio, DNS, alojamiento, permisos ni cuentas. admin.tecruta.com sigue fuera del alcance. La creación/moderación autenticada se comprobó con datos sintéticos en local; en producción se verificaron el login visible y los rechazos sin sesión.

## Evidencias

- [Lecturas HTTP](verificacion-http.json).
- [Tienda pública](tienda-publicada.jpg), [login protegido](panel-publicado.jpg).
- [Tienda Ready/Production](tienda-vercel.jpg), [panel Ready/Production](panel-vercel.jpg).
- [Instantánea previa](respaldo-neon.jpg), [consistencia final](consistencia-neon.jpg).