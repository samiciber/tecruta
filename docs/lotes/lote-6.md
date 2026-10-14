# Lote 6: validación del admin legado y marcas

## Resumen

- H15 resuelto en productos, categorías y métodos de pago legados: schemas Zod 4, valores tipados y PATCH parcial; 400 antes de escribir.
- P2002 → 409, P2025 → 404 y P2003 → 409, sin exponer datos internos ni capturar indiscriminadamente errores al borrar.
- H21 resuelto en creación/edición legada: `brand` y `brandId` se escriben juntos; respuesta idéntica a la API pública con `brandSlug`.
- El formulario permite quitar la marca, explica la selección y conserva el borrador si guardar falla; modo oscuro y nombres accesibles verificados.
- Sin cambios de esquema, migraciones nuevas, despliegue ni acceso a producción; los registros de QA se eliminaron con sus contenedores.

## Archivos

| Ruta | Cambio |
|---|---|
| `server/src/lib/adminSchemas.js` | Create/PATCH de productos y categorías; PATCH de pagos. Precios, stock, booleanos, listas, JSON y campos permitidos. |
| `server/src/lib/adminProducts.js` | Transacciones de producto, resolución de marcas, bloqueo de filas y reemplazo atómico de imágenes. |
| `server/src/routes/admin.routes.js` | Validadores detrás del control ADMIN, servicios de productos y tratamiento acotado de errores de borrado. |
| `server/src/middleware/errorHandler.js` | Mapeo de errores Prisma, respuestas estables y logs sin payloads. |
| `src/pages/admin/ProductForm.jsx` | Marca vacía envía `null`; ayuda, nombre accesible e IDs únicos al mostrar varios formularios. |
| `server/tests/lote-6.test.mjs` | Cinco pruebas pequeñas de fronteras de validación y errores. |
| `server/prisma/tests/lote-6.test.mjs` | Doce pruebas HTTP con PostgreSQL desechable, incluidas concurrencia y rollback. |
| `server/README.md` | Actualiza el estado de validación del admin legado. |
| `docs/lotes/lote-6-integracion-con-lote-3.patch` | Resolución revisable de rutas admin y errorHandler sobre la versión del Lote 3. |
| `docs/lotes/lote-6.md` | Políticas, pasos de prueba, límites y reversión. |

## Contrato y decisiones

**Validación.** El precio y compareAtPrice deben ser números finitos entre 0 y 99 999 999,99 con como máximo dos decimales (Decimal(10,2)); compareAtPrice puede ser null. No se convierten strings, booleanos o null a números. Stock entero de 0 a 2 147 483 647; booleanos reales para active/featured/bestSeller/enable3D. Se aceptan precio y stock cero.

Se permiten únicamente los campos declarados; se rechazan cuerpos desconocidos, PATCH vacíos y campos de relación internos como categoryId. Los slugs conservan mayúsculas existentes y admiten letras ASCII, números, guiones y guiones bajos. Los textos se recortan y limitan; especificaciones y hotspots tienen la forma que consume la web. Configuración de pagos conserva su objeto JSON flexible. URLs de medios admiten HTTP(S) sin credenciales o una ruta local válida; no se aceptan URLs javascript/data ni entradas ambiguas. Esto no modifica la validación de enlaces de navegación reservada a Claude.

**Marcas.** Por defecto se elige una marca existente; este lote no crea marcas automáticamente. Se admite brandId o un nombre exacto ignorando mayúsculas y espacios externos. Se guarda el nombre canónico de la marca, junto a su ID, y se incluye brandRef al serializar, igual que en GET /api/products. El ID permite resolver nombres duplicados y también seleccionar marcas ocultas como administrador. Nombre inexistente o ambiguo devuelve 400 con explicación; si se envían ID y nombre contradictorios también se rechazan.

Para quitar una marca, enviar `brand: null`/vacío o `brandId: null` (sin nombre contradictorio). El formulario ahora envía null al borrar el texto, en lugar de omitir el campo. Omitir ambos campos en PATCH conserva la relación y reconcilia su texto canónico. Si un producto antiguo solo tiene texto, se vincula al nombre existente inequívoco; si no hay coincidencia, la edición falla sin guardar hasta elegir una marca válida o quitarla explícitamente. No se hace una limpieza masiva de productos existentes.

Las ediciones bloquean la fila del producto; la marca seleccionada se bloquea para lectura y se vuelve a consultar antes de escribir. Se prueban ediciones concurrentes de un producto y un cambio de nombre de marca mientras la edición espera. Precio/imágenes/marca se guardan en una misma transacción; un duplicado no deja una edición parcial.

**Alcance de H21.** Son las rutas legadas POST/PATCH /api/admin/products auditadas en H21. No se tocó `adminContent.routes.js`, que sigue reservado: su asignación masiva modifica brandId sin actualizar el texto, y renombrar una marca no propaga el nombre a todos sus productos. Esas operaciones requieren coordinación posterior; una edición legada posterior reconcilia el texto con su relación. El formulario sigue usando el nombre; ante marcas duplicadas se debe corregir la ambigüedad en Admin → Marcas o usar el ID mediante API.

## Cómo probar y evidencia

1. Instalar con `npm ci` en raíz y `server/`; ejecutar `npm run build` en raíz. Build verificado en Node 24.19, Vite 5.4.21 y Prisma 5.22, desde los lockfiles actuales de main. Persisten solo los avisos conocidos de import ubigeo y tamaño del bundle 3D. Las actualizaciones de dependencias siguen en el PR del Lote 5.
2. Desde raíz: `node --test server/tests/lote-6.test.mjs` → 5/5. Cubre precios/stock extremos, tipos, precisión, campos desconocidos, listas/medios, categorías, pagos y errores seguros.
3. Integrar primero la migración de navegación del Lote 2 y generar Prisma con configuración local de QA. Ejecutar `node --test server/prisma/tests/lote-6.test.mjs` → 12/12. Requiere Docker local; crea su propia base y puerto loopback aleatorio, sobrescribe la URL en el proceso con esa base desechable, aplica allí las migraciones y elimina contenedor/volúmenes al salir. Alternativa mientras el PR del Lote 2 siga abierto: `TECRUTA_QA_MIGRATIONS_DIR` apunta a una copia intacta de las cinco migraciones de main más la de navegación. No apuntar herramientas manuales a Neon/producción.
4. Casos HTTP reales: permisos 401/403 antes de validar, entradas inválidas sin escrituras, creación por nombre/ID, nombres ambiguos, marcas ocultas, limpiar/vincular, DTO idéntico a GET público, pertenencia a filtros de marca, reconciliar texto antiguo, rollback de imágenes/precio, categorías duplicadas 409, pagos active false, registro ausente/P2025 404 y FK real de carrito 409 al borrar.
5. Se validó además la resolución con el Lote 3 en una copia temporal fuera del checkout: 22/22 pruebas de PostgreSQL/HTTP (10 pedidos + 12 de este lote) y 5/5 de schemas/errores. Se conservan límites de subida, permisos, máquina de estados, idempotencia y códigos de error del checkout.
6. Abrir `/admin/productos` con ADMIN de QA local o respuestas simuladas. Probar 390, 768, 1024, 1280, 1440 y 1920 px en claro/oscuro: crear, expandir edición y tener ambos formularios abiertos. 36 mediciones pasan: nombre accesible Marca, ayuda correcta e IDs únicos. El campo nuevo de creación queda dentro del viewport; la edición expandida permanece en la tabla con scroll horizontal existente. No se cambió ese diseño.
7. Completar una creación con marca desconocida: el error permanece visible y el borrador se conserva. Cambiar a una marca existente y comprobar payload numérico/tipado. Editar y borrar la marca: la petición PATCH contiene brand:null. Estos flujos y la matriz visual se probaron con API y medios interceptados, sin peticiones a producción ni subidas.

Evidencia local: `/workspace/audit-tecruta/lote-6/`: unit.log, integration.log, combined.log, combined-unit.log, build.log, browser.log, browser.json y capturas de 390/1440 claro/oscuro. La matriz valida el campo/ayuda y comportamiento del formulario; no constituye una nueva auditoría completa de contraste ni del admin. No quedan contenedores de QA de este lote.

## Integración con PR anteriores

`main` permanece en 8470fc1 y los PR anteriores siguen abiertos. El Lote 3 también modifica admin.routes.js y errorHandler.js, por lo que se anticipan conflictos en esos dos archivos al combinar. El parche incluido es un diff sin contexto (`git apply --unidiff-zero`) sobre la versión exacta del Lote 3 y sirve como resolución revisable, no como script de despliegue.

Mantener `createAdminRouter`, inyección del uploader, parsers/validadores de subida, validación de estados y changeOrderStatus del Lote 3. Añadir los imports/schemas y servicios de productos de este lote, sus validadores de categorías/pagos y el catch limitado a P2003. En errorHandler conservar el tratamiento de JSON/413 y los campos productId/code para idempotencia; anteponer el mapeo seguro de Prisma. No reemplazar el archivo por la versión de main ni por el Lote 6 aislado al integrar.

La combinación descrita fue probada en una copia temporal sin cambiar ramas ni integrar PRs. Los módulos de autenticación del Lote 4 no se cambian; tampoco se tocan los archivos reservados de Home, footer, contenido o navSchemas.

## Riesgos y reversión

La validación estricta puede rechazar clientes antiguos que mandan strings numéricos, banderas como texto, slugs fuera del formato, campos extra o estructuras JSON que la UI no sabe mostrar. El formulario actual se probó con su payload completo. Los productos legados con una marca textual sin coincidencia requieren seleccionar/quitar marca antes de guardarlos; no se adivina una relación ni se migra contenido automáticamente. Los bloqueos son breves, dentro de una transacción, y no cubren cambios posteriores hechos por las rutas de contenido reservadas.

Antes de desplegar, integrar/revisar los PR anteriores y probar la resolución. Para revertir: commit de reversión del PR y volver a desplegar API/formulario anteriores. Este lote no necesita migración ni cambio de variables y su código no modifica filas al arrancar. Una reversión no restaura ediciones que un administrador haya guardado después del despliegue; conservar el procedimiento habitual de respaldo.

## Límites

No se accedió ni se escribió a producción. No se probaron Google/correo/Cloudinary reales, subidas, pedidos en producción ni el despliegue final combinado de todos los PR. No se probó la política de nombres duplicados a través de un selector de IDs en UI: el formulario sigue usando texto; el endpoint por ID sí está probado. La propagación de renombrado y asignación masiva queda pendiente por la reserva explícita de adminContent.routes.js.

Lote 6 listo. Escribe continuar para el Lote 7.
