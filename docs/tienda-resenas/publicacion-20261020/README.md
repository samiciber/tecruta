# Publicaci?n realizada ? 20 de octubre de 2026

Autorizada por el titular: ?esta bien publica todo segun el prompt pasado?. Se publicaron redise?o, rese?as verificadas, moderaci?n ADMIN, datos comerciales configurables y opiniones compactas con Ver/Ocultar y tres comentarios por lote.

## Versiones verificadas

| Servicio | Revisi?n | Despliegue | Estado |
|---|---|---|---|
| API Render | 55aa0a6a2c7ead4b4f0a9333a40a4ea59e735388 | dep-dbbh6nu7bikc738id2q0 | Live, 02:09 America/Lima |
| Tienda Vercel | 55aa0a6 | ENBknKLWvS5TzbXRuwYEgTgCs2LU | Ready, Production, 02:11 |
| Panel Vercel | 55aa0a6 | 5CKZB28yGDzDSVSmEiSTeZVkrZEp | Ready, Production |

- Tienda: https://www.tecruta.com
- Panel: https://tecruta-panel.vercel.app
- Moderaci?n: https://tecruta-panel.vercel.app/resenas (ADMIN).
- Configuraci?n: https://tecruta-panel.vercel.app/datos-comerciales (ADMIN).
- C?digo: rama feature/rediseno-tienda-resenas en GitHub. No hubo merge ni push a main. Los commits posteriores de evidencia y transporte de pruebas no cambian el c?digo funcional desplegado.

## Migraci?n y recuperaci?n

Neon cre? previamente la instant?nea manual production at 2026-10-20 07:04:32 UTC (manual), visible sin caducidad. No se restaur? sobre producci?n ni se trasladaron datos reales al QA. El 20 de octubre a las 02:08:31?32 America/Lima, Render ejecut? prisma migrate deploy con su conexi?n existente: se aplic? exclusivamente 20261020000000_product_reviews y se regener? Prisma Client 5.22.0. No se editaron migraciones anteriores ni credenciales. El build temporal fue restaurado a npm ci && npx prisma generate; autodeploy permanece desactivado en Render.

Consulta final de lectura en Neon: migraci?n terminada, sin rollback, cero migraciones fallidas, cero rese?as/votos/invitaciones y cero diferencias entre contadores y rese?as aprobadas. Las opiniones de prueba permanecen solo en la base QA.

Para recuperaci?n funcional, usar los despliegues anteriores registrados en preparacion.md y el panel anterior FYnGyPPbSkDMoRBCEKLagsJ8WnqH. Conservar las tablas y registros de rese?as; no restaurar una instant?nea sobre ventas posteriores ni borrar movimientos. Si se a?adi? un bloque CMS reviews, retirarlo desde el panel compatible antes de volver a la API antigua. Ver ../publicacion-recuperacion.md.

## Comprobaciones

- 63/63 pruebas vigentes en PostgreSQL local desechable; ambos builds y diff --check correctos. La repetici?n para corregir la codificaci?n del log detect? un fetch failed en el cliente local despu?s de la prueba de migraci?n s?ncrona, seguido de cuatro fallos dependientes de ese estado. Se conserva en ../validacion/prepublicacion-intermitente.log. El transporte de la suite de personal ahora cierra cada conexi?n HTTP para evitar reutilizar un socket keep-alive vencido durante el bloqueo de la prueba s?ncrona; no se cambi? ninguna aserci?n ni c?digo de producci?n. Reejecuci?n final completa de las mismas 63 pruebas: todas correctas, sin omitidas, log UTF-8 en ../validacion/prepublicacion.log.
- API health 200 y revisi?n exacta; cat?logo 200 con 149 productos y campos de calificaci?n; rese?as vac?as y resumen cero sin estrellas inventadas.
- Moderaci?n, personal, inventario y POS sin sesi?n: 401. CORS devuelve ?nicamente el origen autorizado de tienda o panel; example.com no recibe Access-Control-Allow-Origin.
- Tienda y panel 200, recursos JS de producci?n nuevos apuntan a la API correcta; panel conserva noindex. Navegador: portada con CMS real y medios de pago configurados; /resenas redirige al login si falta sesi?n. No se introdujeron contrase?as ni se probaron cobros/compras/escrituras con datos reales.
- Ninguna prueba ni seed se ejecut? contra producci?n. Las lecturas finales son comprobaciones operativas de despliegue, sin cambios en datos de negocio.

## Pendientes y l?mites conservados

La bater?a hist?rica completa sigue teniendo los mismos 57 fallos que main, detallados en ../validacion/comparacion.json y conciliados en preparacion.md. No se declara toda la bater?a hist?rica correcta. Los cinco avisos altos anteriores de dependencias de desarrollo contin?an; no se a?adieron dependencias ni se cambiaron versiones.

El due?o debe completar o confirmar raz?n social, RUC, direcci?n, URL del Libro de Reclamaciones, garant?a y env?os en Datos comerciales; los vac?os se ocultan. Las invitaciones siguen apagadas y sin job programado: activarlas solo tras aprobar remitente, contenido y frecuencia. La moderaci?n de rese?as reales queda a cargo del ADMIN. La web no mostrar? opiniones hasta recibir compras entregadas y rese?as aprobadas; en portada exige al menos tres.

No hubo cambio de dominio, DNS, alojamiento, permisos o cuentas. admin.tecruta.com sigue fuera del alcance de esta publicaci?n. La prueba de login ADMIN autenticada y la creaci?n/moderaci?n se comprobaron con datos sint?ticos en local; en producci?n se verificaron el login visible y los rechazos de acceso sin sesi?n.

## Evidencias

- [Lecturas HTTP](verificacion-http.json).
- [Tienda p?blica](tienda-publicada.jpg), [login protegido](panel-publicado.jpg).
- [Tienda Ready/Production](tienda-vercel.jpg), [panel Ready/Production](panel-vercel.jpg).
- [Instant?nea previa](respaldo-neon.jpg), [consistencia final](consistencia-neon.jpg).
