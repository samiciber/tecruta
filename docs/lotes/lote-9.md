# Lote 9 — comprobante y estados en Mis pedidos (H35)

Rama `fix/lote-9-historial-pedidos`, desde `main` actualizado a `60917ed`.
Se muestran el comprobante y las transiciones registradas del propietario,
con fechas en `America/Lima`. Se conserva el estado actual y se indica cuando
un pedido antiguo no tiene historial o comprobante. No se inventan eventos.

## Archivos y comportamiento

| Archivo | Cambio |
| --- | --- |
| `server/src/lib/customerOrders.js` | Include del historial ordenado por fecha/id; DTO de cliente sin notas internas, URL de Cloudinary ni hashes. Añade `hasReceipt` y `statusHistory`. |
| `server/src/lib/receiptDownload.js` | Lectura HTTPS del host exacto `res.cloudinary.com`, solo rutas `image/upload` o `raw/upload`, sin redirecciones, con plazo de 10 s y máximo 8 MiB decodificados. Valida firmas PNG/JPEG/GIF/WebP/PDF y MIME; rechaza HTML/SVG y errores del proveedor sin exponer detalles. |
| `server/src/routes/customerOrders.routes.js` | GET `/api/orders/me` y `/api/orders/me/:orderId/receipt`, ambos autenticados y sin caché. Filtra por `req.user.id`; el comprobante tiene límite de 30 consultas por 15 minutos/IP. |
| `server/src/routes/orders.routes.js` | Delega las lecturas del propietario al nuevo router; no cambia las escrituras de pedidos ni subidas de este lote. |
| `src/pages/OrderHistory.jsx` | Línea de tiempo, consulta autenticada de imagen/PDF, carga/error/reintento y revocación de URLs blob. Oculta datos al validar sesión, salir o cambiar de usuario/token; descarta respuestas tardías. Conserva las señales de sesión del Lote 4. |
| `src/services/orderReceipt.js` | Lee el archivo binario con Bearer y `cache: no-store`; admite cancelación y rechaza tipos distintos de imágenes raster/PDF. Reutiliza `API_URL` sin modificar la API compartida. |
| `server/tests/lote-9.test.mjs` | Siete pruebas pequeñas de DTO, URLs, firmas, tamaño, errores y timeout; proveedor simulado. |
| `server/prisma/tests/lote-9.test.mjs` | Seis pruebas HTTP con el router completo y PostgreSQL desechable; sesión/propietario/IDOR, contrato e integridad de datos. |
| `docs/lotes/lote-9-integracion-con-lote-3.patch` | Resolución preparada del conflicto de lecturas con el Lote 3. |
| `docs/lotes/lote-9.md`, `docs/lotes/balance-final.md` | Evidencia, límites, integración y balance de los lotes autorizados. |

No se añaden tablas ni columnas. El historial y `receiptUrl` ya existen en el
esquema. La serialización de creación/admin permanece intacta; solo la lista
del cliente sustituye `receiptUrl` por `hasReceipt` y añade el historial.
No hay bypass ADMIN en estas rutas: un administrador ve sus propios pedidos;
las rutas específicas de administración conservan su autorización independiente.

Una consulta del comprobante de otro cliente, de un invitado, de un ID inexistente
o de un pedido sin archivo devuelve el mismo 404. Sin sesión válida devuelve
401. Ninguna de esas consultas llama al proveedor. `?userId=` y `?orderId=` no
pueden cambiar el propietario de la lista. No se incluyen notas del admin.

## Pruebas ejecutadas

- `npm run build`: correcto con Node 24.19.0/npm 11.9.0 y dependencias del lockfile
  actual de `main`; permanece el aviso conocido de tamaño de chunks.
- `node --test server/tests/lote-9.test.mjs`: **7/7**.
- `node --test server/prisma/tests/lote-9.test.mjs`: **6/6**, después de disponer
  del historial del Lote 2. PostgreSQL propio, puerto loopback aleatorio y JWT
  sintéticos; toda petición de archivo se sustituye, sin llamar a Cloudinary.
- Navegador sobre el build compilado: **36 mediciones** (historial, PNG, PDF ×
  seis anchos × dos temas), sin desbordamiento (`scrollWidth <= clientWidth`).
  También comprobó ausencia de historial/archivo, reintento de pedidos y
  comprobante, rechazo de HTML, lista vacía e invitado sin consulta privada.
- Harness local del componente: **7 comprobaciones** de respuesta tardía al
  cambiar A→B, error tardío, consulta por teclado, revocación de blob al cambiar
  de cuenta, cancelación de descarga anterior y protección durante error/carga
  de sesión y logout. El harness controla el contexto de auth; no es un login real.
- Copia de integración fuera del checkout con Lotes 2/3/4/7/9 y `main` actual:
  build correcto y **17/17 pruebas PostgreSQL/HTTP** (10 de pedidos del Lote 3,
  seis de este lote y una adicional de revocación JWT del Lote 4). Se comprueban
  idempotencia, stock, subidas y transiciones junto con las nuevas lecturas.
  El test antiguo que esperaba exactamente siete migraciones se adapta solo en
  esa copia a contar el historial completo de ocho; se mantienen los asserts de
  diff vacío, conservación y despliegue desde cero.
- En esa copia integrada, otras **36 mediciones del build compilado** verifican
  los mismos estados, seis anchos y dos temas, también sin desbordamiento ni
  errores JavaScript.

Evidencia local fuera del repositorio: `/workspace/audit-tecruta/lote-9/`:
`unit.log`, `integration.log`, `build.log`, `browser.json`, `session.json`,
`combined-generate.log`, `combined-integration.log`, `combined-build.log` y
scripts de navegador. Las pruebas usan datos ficticios y medios/API simulados.
Los contenedores se crean y eliminan por sus propios runners; no hay escrituras
en producción ni registros de producción creados por este lote.

## Cómo reproducir

1. Instalar dependencias con `npm ci` en raíz y `server/`; generar Prisma con
   `npm run prisma:generate` en `server/`, sin ejecutar migraciones contra una
   base real. Ejecutar el build y las siete pruebas pequeñas anteriores.
2. Para las pruebas PostgreSQL, integrar primero el SQL del Lote 2 o copiar el
   historial de migraciones intacto a un directorio de QA. Ejecutar:

   ```bash
   TECRUTA_QA_MIGRATIONS_DIR=/ruta/qa/migrations \
     node --test server/prisma/tests/lote-9.test.mjs
   ```

   Requiere el daemon Docker local. El runner crea su propia base y sobrescribe
   `DATABASE_URL`/JWT con valores de QA antes de cargar módulos; no reutiliza
   `.env` ni credenciales del sitio. No apuntar ese directorio a datos ajenos.
3. Servir el build con `npm run preview`; con API local/interceptada, probar
   `/mis-pedidos` a 390, 768, 1024, 1280, 1440 y 1920 px, claro y oscuro. Confirmar
   eventos en orden, fechas/hora de Perú, estado actual y el mensaje del historial
   vacío. Consultar un PNG y un PDF con el botón; confirmar alt, navegación por
   teclado y enlace accesible a una nueva pestaña. Simular un error y reintentar.
4. Con sesiones locales A/B, consultar el ID del pedido A usando B: esperar
   404 y ninguna lectura del proveedor. Probar también administrador no propietario
   (404), invitado/token inválido (401) y `GET /me?userId=<otro>` (solo pedidos propios).
5. Simular respuestas demoradas y cambiar de usuario: no deben aparecer pedidos
   ni blobs de la cuenta anterior. No se necesita crear pedidos en producción.

## Integración y reversión

Los PR previos continúan abiertos. No reemplazar el router entero del Lote 3 por
el de `main`: perdería autorización de subidas, límites, idempotencia y stock
atómico. Sobre su versión exacta, manteniendo los archivos nuevos de este lote:

```bash
git apply --check --unidiff-zero docs/lotes/lote-9-integracion-con-lote-3.patch
git apply --unidiff-zero docs/lotes/lote-9-integracion-con-lote-3.patch
```

El parche conserva `createOrdersRouter({ db, uploadReceipt })` y todos sus POST;
solo importa `createCustomerOrdersRouter` y delega las lecturas pasándole `db`.
La copia de QA comprobó esa resolución, sin cambiar la rama del Lote 3.

Conflicto con el Lote 4 en `OrderHistory.jsx`: conservar la versión de este lote,
que ya contempla `authError`, `retrySession` y `authLoading` además de los guards
por usuario/token. Con el Lote 7, la simulación `git merge-tree` no presenta
conflictos; se conserva su API compartida y la lectura binaria queda separada.
La prueba conjunta no incluye los cambios de dependencias del Lote 5 ni la
validación admin del Lote 6: no se presenta como validación de todos los PR juntos.

Para revertir, revertir los commits de este lote; si ya se integró el Lote 3,
restaurar su GET `/me` anterior en vez del router antiguo de `main`. No hay cambios
de esquema, proveedores o variables que revertir. Frontend y API deben desplegarse
con el mismo contrato `hasReceipt/statusHistory`.

## Límites

La autorización protege las lecturas de TecRuta. Los activos antiguos de
Cloudinary siguen teniendo su modo de entrega existente: quien ya conserve una
URL pública podría abrirla directamente. Este lote no convierte ni borra activos
en el proveedor; la privacidad del almacenamiento requeriría una tarea aparte.

No se vinculan compras de invitado por correo: siguen con `userId=null` y no
aparecen en Mis pedidos. H35 queda resuelto en el comprobante y la línea de tiempo
del propietario; la vinculación verificada de invitados queda fuera del alcance.
No se probaron login Google real, archivos existentes del proveedor, email ni
despliegue. Los medios simulados permiten validar interfaz y permisos sin acceder
a datos de clientes. No se tocan archivos reservados a Claude ni producción.
