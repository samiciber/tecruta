# Lote 3: pedidos, comprobantes y checkout

## Resumen

H07: comprobantes protegidos por propietario, ADMIN o capacidad por pedido invitado.
H08: límites de JSON, rate limit y validación de tamaño decodificado y firmas.
H09: cantidades agrupadas y stock/precios comprobados en una transacción.
H10: confirmación antes de vaciar carrito, reintentos idempotentes y WhatsApp desde la respuesta.
H11: transiciones explícitas; cancelación concurrente devuelve stock una sola vez.

Estos hallazgos quedan corregidos en código y comprobados localmente, pendientes
de fusionar/desplegar. No se crearon pedidos ni se hicieron escrituras en producción.
`trust proxy` se adelanta de H32 para que el rate limit funcione por IP detrás de
Render; el resto de H32 y los lotes de OAuth/dependencias permanecen pendientes.

## Archivos

| Ruta | Qué cambió |
|---|---|
| `server/prisma/schema.prisma` | Tres campos opcionales en Order y comentarios del nuevo permiso de recibo. |
| `server/prisma/migrations/20261012000001_add_order_receipt_token_idempotency/migration.sql` | Tres columnas nullable y un índice único, en transacción. |
| `server/src/lib/orderPolicy.js` | Agrupación con límites, hash de capacidades y permisos de recibo. |
| `server/src/lib/orderService.js` | Stock/precios, importes Decimal, idempotencia y cambio de estado transaccionales. |
| `src/utils/orderStatus.js` | Transiciones compartidas por API y selector admin. |
| `server/src/lib/uploadValidation.js` | Base64 canónico, tamaños, firmas, MIME y estructura básica GLB/glTF. |
| `server/src/middleware/bodyLimits.js` | JSON general 100 KB y parsers específicos de subida. |
| `server/src/middleware/orderLimits.js` | Rate limit separado para pedidos y comprobantes. |
| `server/src/middleware/errorHandler.js` | Errores de límite/JSON en español, productId y códigos acotados; logs sin cuerpos ni capacidades. |
| `server/src/routes/orders.routes.js` | Nuevo servicio, permisos antes de leer/subir recibos y respuesta mínima. |
| `server/src/routes/admin.routes.js` | Enum de filtros/estados, servicio de transición y subidas validadas; factory para sustituir uploader en pruebas. |
| `server/src/index.js` | Parsers, proxy configurable y factory de app para pruebas sin arrancar un servidor externo. |
| `server/src/lib/serializers.js` | Interior y destinatario necesarios para el WhatsApp confirmado; no serializa hashes/claves. |
| `src/services/api.js` | Headers de idempotencia y sesión/capacidad de recibo; códigos de error. |
| `src/services/checkoutOrder.js` | Intento persistido en sessionStorage y distinción de errores ambiguos. |
| `src/pages/Checkout.jsx` | Confirmación esperada, estado de error/reintento, vista confirmada y subida independiente. |
| `src/components/checkout/WhatsAppButton.jsx` | Botón de registro con estado ocupado; sin navegación anticipada. |
| `src/components/checkout/ReceiptUpload.jsx` | Tipos admitidos y selección accesible por teclado con foco visible. |
| `src/utils/whatsapp.js` | Construye mensaje con productos, importes y datos de la respuesta confirmada. |
| `src/pages/admin/AdminOrders.jsx` | Bearer al subir, respuesta mínima y opciones de estado inválidas deshabilitadas. |
| `src/pages/admin/ProductForm.jsx` | Selector/validación de imágenes alineados a formatos admitidos. |
| `tests/lote-3.test.js` | Seis pruebas ligeras de política, archivos, reintentos y mensaje. |
| `server/prisma/tests/lote-3.test.mjs` | Diez pruebas de PostgreSQL y HTTP local, incluyendo concurrencia, permisos y CORS. |
| `server/README.md` | Contratos, límites y comando de prueba. |
| `docs/lotes/lote-3.md` | Este informe, decisiones y despliegue. |

No se modifican `.env`, dependencias, lockfiles, migraciones históricas ni los
archivos reservados para Home/Claude. La rama parte de main actualizado
(`8470fc1` al iniciar este lote); los PR anteriores seguían sin fusionar.

## Decisiones y contratos

### Idempotencia y recibos

- La clave es un UUID v4 criptográfico por intento, enviado en `Idempotency-Key`.
  La base almacena su SHA-256 en `idempotencyKey` (nullable y único), junto a
  `requestHash` del contenido normalizado y del usuario/invitado. Las categorías
  y productos no necesitan nuevas columnas en este lote.
- Un bloqueo advisory de PostgreSQL por clave serializa reintentos antes de
  comprobar stock. El mismo contenido/cuenta devuelve el mismo pedido: 201 al
  crearlo y 200 al recuperarlo. Cuerpo o cuenta distintos: 409
  `IDEMPOTENCY_CONFLICT`, sin datos del pedido anterior. Se agrupan hasta 200
  líneas y se rechazan cantidades fraccionarias, negativas o que excedan Int.
- La capacidad de recibo invitado se deriva con HMAC-SHA256 del secreto del
  servidor y los hashes del intento, con un dominio específico. Solo
  `receiptTokenHash` se guarda en Order; no se guarda el token en texto claro.
  Derivarla permite recuperarla al repetir **el POST de creación del mismo
  invitado**, si se perdió la primera respuesta. Ningún listado la devuelve.
- Una sesión proporcionada debe validar: no se convierte silenciosamente en
  invitado. En recibos se exige propietario/ADMIN o capacidad correcta de un
  pedido sin userId, antes del parser grande y antes del uploader.
- El borrador con clave y datos del pedido permanece solo en sessionStorage de
  esa pestaña mientras su resultado es incierto. Se borra al confirmar; no se
  persiste ahí el token de recibo ni el JWT. Si el navegador no permite guardar
  el intento, no se envía el pedido. No imprimir/loguear claves ni capacidades.
- Una respuesta perdida o 5xx mantiene el mismo intento. En un reintento, un
  400/401/413/429 tampoco prueba que el primer pedido no se haya guardado: se
  conserva la clave. Solo `ORDER_REJECTED`, emitido después del bloqueo y de
  verificar que no existía ese intento, permite desbloquear los datos con
  seguridad. Un cambio de cuenta exige volver a la sesión original.
- El checkout muestra una confirmación con total/productos del servidor antes
  de habilitar el enlace WhatsApp; abrirlo requiere un segundo clic, para evitar
  bloqueos de ventanas emergentes tras una espera asíncrona. No usa datos
  bancarios cacheados en el mensaje: el método es la etiqueta devuelta por API.
- La subida de recibo tiene su propio estado/error y reintenta únicamente esa
  operación. Un intento recuperado como CANCELLED conserva el carrito y ofrece
  revisarlo, sin abrir WhatsApp para ese pedido.

Los pedidos antiguos conservan los tres campos en NULL. El ADMIN puede adjuntar
comprobantes antiguos; invitados antiguos sin hash no obtienen una capacidad por
conocer el ID. La capacidad nueva se mantiene en memoria en la pantalla de
confirmación: al cerrar/recargarla después de confirmar, una subida posterior
de invitado requiere coordinar con el admin. Rotar JWT_SECRET mantiene válidos
los tokens de recibo ya entregados (se comparan contra su hash), pero impide
recuperar la capacidad derivada antigua en reintentos; no cambia el pedido ni
vuelve a descontar stock.

### Stock, límites y estados

El stock se decrementa con `updateMany` condicionado a `stock >= quantity` y al
precio/compareAtPrice leído dentro de la transacción. Si algún producto falta o
cambia, responde 409 con productId y revierte toda la reserva y el pedido. No
recorta cantidades ni descarta productos para crear un pedido parcial. Los
importes se calculan con Prisma.Decimal; total = subtotal y savings es informativo.
Un método de pago desactivado/inexistente también revierte el intento.

| Ruta | Máximo de JSON | Máximo decodificado | Formatos |
|---|---|---|---|
| Rutas normales | 100 KB | — | JSON |
| POST admin/uploads | 7 MiB | 5 MiB | JPEG, PNG, GIF, WebP |
| POST orders/:id/receipt | 12 MiB | 8 MiB | Los anteriores y PDF |
| POST admin/uploads/model | 21 MiB | 15 MiB | GLB/glTF 2.0 |

El margen de JSON cubre base64. Se verifica longitud decodificada, base64
canónico y firma correspondiente al MIME; se rechazan SVG y archivos con tipo
declarado diferente. En modelos se verifica además cabecera/chunks GLB o asset
glTF. Son validaciones de formato, no un análisis antivirus ni un decodificador
completo de imágenes/PDF. Los permisos preceden a los parsers de subida.

Rate limit por IP/proceso: 20 intentos de pedido / 30 de comprobante por 15
minutos, incluidos intentos inválidos. El store es en memoria; varios procesos
tienen contadores independientes. `TRUST_PROXY` admite enteros 0–5, por defecto
1 para Render; 0 en pruebas locales. No se activa confianza ilimitada.

| Estado actual | Siguientes estados |
|---|---|
| PENDING | CONFIRMED, PAID, CANCELLED |
| CONFIRMED | PAID, SHIPPED, CANCELLED |
| PAID | SHIPPED, CANCELLED |
| SHIPPED | DELIVERED |
| DELIVERED | Ninguno |
| CANCELLED | Ninguno |

Se permite pasar CONFIRMED → SHIPPED para contra entrega y PENDING → PAID
cuando el pago ya está comprobado. No se cancela un pedido enviado/entregado;
devoluciones necesitan un flujo posterior. Repetir el mismo estado es un no-op
sin otra línea de historial. Un bloqueo de fila de Order garantiza que dos
cancelaciones vean el estado actualizado y devuelvan stock solo una vez.
Filtros `?status=` inválidos o repetidos y cuerpos inválidos devuelven 400;
transiciones prohibidas devuelven 409.

## Cómo probar y evidencia

Fusionar primero el PR del Lote 2 para disponer de su migración. Con dependencias
instaladas desde lockfiles y Docker iniciado, desde la raíz:

```bash
DATABASE_URL='postgresql://qa_unused@127.0.0.1:1/unused' server/node_modules/.bin/prisma generate --schema server/prisma/schema.prisma
node --test tests/lote-3.test.js
node --test server/prisma/tests/lote-3.test.mjs
npm run build
git diff origin/main --check
```

La URL de generate es un marcador local: generar el cliente no conecta a la
base. Las pruebas de integración sobrescriben DATABASE_URL con su propio puerto
loopback aleatorio, crean cuentas/pedidos/stock ficticios y eliminan el contenedor
y sus volúmenes. Reemplazan Cloudinary por un uploader local; no usan secretos
reales ni contactan servicios externos.

Al validar este PR, el Lote 2 aún no estaba fusionado: se copió su SQL **sin
modificarlo** desde su rama a un directorio temporal fuera del repositorio y se
pasó `TECRUTA_QA_MIGRATIONS_DIR` a la suite. No se duplicó esa migración en este
PR. Con los siete archivos de ambos lotes, diffs desde la base y desde el
historial a `schema.prisma` son vacíos; la base vacía y una base con las seis
migraciones anteriores se actualizan correctamente. El pedido ficticio antiguo
conserva total 123.45 y receiptUrl, con las tres columnas nuevas en NULL.

| Hallazgo / prueba | Resultado verificado |
|---|---|
| H07 permisos | Sin credencial 401, Cliente B contra A 403, capacidad de otro invitado 401; propietario, ADMIN y capacidad correcta 200. Respuesta contiene únicamente ok/receiptUrl; listados sin hashes/claves/tokens. |
| H08 límites | JSON normal >100 KB 413; imagen >5 MiB y recibo >8 MiB decodificados 413. MIME falsificado y firma inválida 400 antes del uploader; modelo falso 400 y glTF válido aceptado por stub. Rate limits responden 429; preflight acepta headers nuevos. |
| H09 stock | Duplicados 2+3 generan una línea de 5 y total 49.95. Dos compras distintas simultáneas: una 201, otra 409, stock nunca negativo. Si falta stock en una línea, se conserva el stock de las demás y no aparece un pedido parcial. |
| H10 idempotencia | Dos POSTs simultáneos iguales: 201/200, mismo pedido/capacidad y un descuento. Cuerpo/cuenta cambiados con la misma clave: 409. Navegador conserva intento y carrito ante pérdida de respuesta, incluso tras recarga y un 429 posterior. |
| H10 UI | Confirmación antes del enlace WhatsApp; mensaje con nombre/productos/total devueltos, sin valores cacheados. Subida fallida permite reintentar sin otro POST de pedido. Foco en el encabezado de confirmación. |
| H11 estados | Dos cancelaciones simultáneas 200/200: stock vuelve una vez e historial CANCELLED una vez. Flujo legal hasta DELIVERED, no-op sin duplicar líneas; terminales no reabren; filtros inválidos 400. Selector admin deshabilita opciones prohibidas. |

Resultado: **6/6 pruebas ligeras y 10/10 pruebas de PostgreSQL/HTTP pasan**, sin
omitidas. Vite build termina con código 0; persisten avisos previos de ubigeo y
tamaño del componente 3D. `git diff --check` sin incidencias.

Validación de navegador local con API interceptada y datos públicos de referencia:
390, 768, 1024, 1280, 1440 y 1920 px, claro y oscuro. Cuatro estados del checkout
(espera, error, intento recargado y confirmación) y admin con recibo actualizado:
**60 comprobaciones sin desbordamiento**, `scrollWidth <= clientWidth`, sin
errores de JavaScript. Capturas, matriz y checks en
`/workspace/audit-tecruta/lote-3/`; no se añadieron dependencias de navegador al proyecto.

Pasos manuales **solo en la base/API desechable**:

1. Recorrer los tres pasos con datos ficticios y un producto con stock. Comprobar
   que no se habilita el registro sin datos/método; durante el envío el botón
   queda ocupado y no permite doble clic.
2. Simular pérdida de conexión/503 al registrar: carrito intacto, mensaje y
   Reintentar; recargar, reintentar y comprobar mismo pedido, no otra reserva.
   Después de una respuesta perdida, un 401/429 conserva la misma clave.
3. Confirmar y comprobar productos/total del servidor. WhatsApp aparece solo
   después; Tab llega al enlace y al selector de archivo, con foco visible.
4. Simular error del uploader: Reintentar comprobante solo vuelve a esa ruta;
   no registra otro pedido. En admin comprobar la URL nueva sin perder detalle.
5. Repetir en los seis anchos y ambos temas; medir scrollWidth/clientWidth.
6. Ejecutar la suite concurrente; usar únicamente sus cuentas y datos sintéticos.

## Despliegue de producción: instrucciones, no ejecutadas

1. Fusionar los lotes anteriores y este PR; revalidar el árbol final. El Lote 2
   debe conciliar su historial siguiendo su procedimiento, incluida la consulta
   legacy. Este lote no corrige ni marca automáticamente su migración anterior.
2. Poner checkout en mantenimiento durante el cambio coordinado de API y SPA.
   El cliente antiguo no envía Idempotency-Key y el nuevo servidor lo rechazará;
   no dejar ambos contratos activos sin coordinar su publicación.
3. Respaldar con pg_dump desde una sesión segura usando conexión directa/SSL;
   comprobar que el respaldo se restaura en una base desechable, como en el
   procedimiento del Lote 2. No imprimir credenciales ni editar/subir `.env`.
4. Desde `server`, con el checkout correcto y conexión de producción configurada
   por el operador, revisar `npx --no-install prisma migrate status --schema
   prisma/schema.prisma` y el diff de datasource a datamodel. Debe quedar pendiente
   únicamente `20261012000001_add_order_receipt_token_idempotency` tras conciliar
   el Lote 2. El diff debe agregar solo las tres columnas nullable y su índice.
   No usar resolve para saltarse esta nueva migración si esos objetos no existen.
5. El operador ejecuta `npx --no-install prisma migrate deploy --schema
   prisma/schema.prisma`, verifica status al día/diff vacío y genera el cliente
   con `npx --no-install prisma generate --schema prisma/schema.prisma` en el
   proceso de build del backend. No db push, reset, dev ni seeds en producción.
6. Publicar primero la API nueva con su cliente generado y después la SPA nueva,
   dentro de mantenimiento. Comprobar JWT_SECRET/CORS existentes y la cantidad
   real de proxies; TRUST_PROXY por defecto es 1, nunca true. Validar salud y
   lectura de rutas; las pruebas de pedidos siguen en base desechable.
7. Cerrar mantenimiento después de comprobar el despliegue coordinado. No
   reutilizar claves/datos sintéticos de las pruebas ni modificar pedidos reales
   para verificar esta fase.

## Riesgos y reversión

- Contrato de recibos más estricto y creación con clave obligatoria: actualizar
  cualquier cliente externo y coordinar API/SPA. Los invitados antiguos pasan a
  requerir ayuda del ADMIN para comprobantes.
- El DDL toma un bloqueo breve en orders. Campos nullable preservan registros y
  permiten mantener el esquema ampliado aunque se retire código. No se renombra
  ni modifica ninguna migración ya aplicada.
- Stock/transiciones usan locks y timeout transaccional de 10 segundos; una
  saturación devuelve error sin crear pedido parcial y conserva el intento para
  reintentar. El límite por proceso no es un contador global entre réplicas.
- sessionStorage guarda datos personales del borrador por pestaña hasta resolver
  el intento. No abandonarlo borrando la clave si se desconoce si se guardó el
  pedido; primero comprobar/reintentar con la misma cuenta. No se incluyen
  capacidades ni datos privados en informes/logs.
- Antes de desplegar: revertir los commits/PR. Después: no borrar columnas,
  hashes, índices ni pedidos. Un revert de Git no revierte la base y recuperaría
  el comportamiento inseguro anterior; mantener mantenimiento y preparar una
  corrección o reversión revisada. Restaurar un respaldo necesita considerar las
  escrituras posteriores. No se entrega un down destructivo.

## Lo que no se probó

No se ejecutó este código en Neon/Render ni se probaron credenciales productivas,
Cloudinary real, envío real por WhatsApp o un respaldo real. API/stock/concurrencia
se probaron con PostgreSQL real desechable; proveedor sustituido y navegador con
API interceptada. No hay registros ni IDs creados en producción que borrar.

No se corrigen todavía OAuth, recuperación de cuenta, persistencia de sesión,
dependencias, fallback/caché de catálogo, datos del banner ni archivos de Home
reservados. Los cambios del Lote 1 permanecen en su PR; este lote no los duplica.

Lote 3 listo. Escribe continuar para el Lote 4.
