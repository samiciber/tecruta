# Lote 2: historial de navegación y guardados (H12)

## Resumen

La sexta migración permite reconstruir `schema.prisma` desde las cinco anteriores.
Agrega los objetos faltantes y marca las ocho categorías originales como `legacy`.
Conserva registros, relaciones, precios y stock; no ejecuta seeds.
Documenta el nombre histórico impreciso de la migración 3D sin modificarla.
H12 queda corregido en Git; la conciliación del historial de Neon queda para el operador.

## Archivos

| Ruta | Qué cambió |
|---|---|
| `server/prisma/migrations/20261012000000_add_nav_brands_stores_saved_items/migration.sql` | DDL faltante y actualización acotada de `legacy`, dentro de una transacción. |
| `server/prisma/tests/lote-2.test.mjs` | Cuatro pruebas con `node:test`, Docker y Prisma existentes; sin dependencias nuevas. |
| `server/prisma/tests/lote-2-fixtures.sql` | Datos ficticios en cada tabla de las cinco migraciones anteriores. |
| `server/README.md` | Aclara desarrollo local, historial 3D y enlace al procedimiento de producción. |
| `docs/lotes/lote-2.md` | Evidencia, pruebas, despliegue por casos y reversión. |

## Qué incluye la migración

- Enum `NavItemType`: `LINK`, `HEADING`, `DIVIDER`, `SUBMENU`, `PROMO`.
- Tablas `category_tiles`, `brands`, `nav_items`, `popular_searches`, `stores`,
  `site_settings` y `saved_items`, con sus siete claves primarias.
- Columnas de `categories`: `image`, `legacy`, `parentId`, `position`,
  `sourceRef`, `visible`. Columna nullable `products.brandId`; se conserva `brand`.
- Índices `category_tiles_categoryId_idx`, `brands_slug_key` (único),
  `nav_items_menuKey_position_idx`, `nav_items_parentId_idx`,
  `saved_items_userId_productId_key` (único), `categories_parentId_idx`,
  `products_brandId_idx`.
- Claves foráneas `categories_parentId_fkey`, `category_tiles_categoryId_fkey`,
  `nav_items_parentId_fkey`, `saved_items_userId_fkey`,
  `saved_items_productId_fkey`, `products_brandId_fkey`.
- `UPDATE categories SET legacy = true` solo para los slugs `power-banks`,
  `cargadores`, `cables`, `audifonos`, `accesorios`, `celulares`, `tablets`,
  `laptops` que estén presentes y todavía tengan `legacy = false`. No crea las
  categorías si faltan. La lista queda congelada en SQL desde `navSeed.js`.

Los objetos coinciden con el diff del Lote 0. Main seguía en `8470fc1` al preparar
este lote. El usuario confirmó que su carpeta local también contiene solo las
cinco migraciones conocidas: no hay archivo local de navegación que recuperar
según la evidencia proporcionada.

El DDL es intencionalmente explícito, sin `IF NOT EXISTS`: una base parcialmente
modificada debe detectarse y revisarse, evitando ocultar diferencias.

## Cómo probar y evidencia

Desde la raíz del repositorio, instala las dependencias con `npm ci` y
`npm --prefix server ci` si no están instaladas. Requiere Docker en ejecución.

```bash
node --test server/prisma/tests/lote-2.test.mjs
npm run build
git diff --check
```

La suite fija la imagen de PostgreSQL por digest, usa un puerto aleatorio ligado
a `127.0.0.1`, crea bases sintéticas y elimina su contenedor al terminar. La
autenticación `trust` se limita al contenedor desechable sin datos reales; no es
una configuración para reutilizar en servicios persistentes. Cada invocación
de Prisma recibe explícitamente su `DATABASE_URL` local. No se modifica `.env`.

| Prueba | Resultado esperado |
|---|---|
| Base vacía | Se aplican las seis migraciones; diff desde la base y desde el historial (con shadow desechable) contra `schema.prisma` vacío, status al día y segundo deploy sin pendientes ni cambios de historial. |
| Base con las cinco anteriores | Conserva todos los campos y registros originales de las 11 tablas; marca exactamente ocho slugs y deja la categoría de control sin `legacy`. Mantiene asociación del producto, precio 49.90 y stock 7. |
| Esquema y datos ya presentes | `resolve --applied` seguido de `deploy` no ejecuta DDL ni cambia los datos, incluidos registros de las siete tablas nuevas. |
| Error antes del commit | Se revierten tablas, enum, columnas y cambio `legacy`; los datos originales permanecen idénticos. |

Resultado verificado: **4/4 pruebas pasan**, sin omitidas; ambos diffs son vacíos.
El build de Vite termina con código 0 y `git diff --check` sin incidencias.

No hay cambios visuales: los seis anchos y los dos temas no requieren una nueva
matriz en este lote. Se verifica el build de Vite; las advertencias previas de
ubigeo y del tamaño del componente 3D siguen fuera del alcance.

## Producción: pasos para el operador

**Estas instrucciones se entregan para revisión. El agente no las ejecutó en
Neon ni en ningún servicio de producción.** No se cambia la versión mayor de
Prisma para este trabajo: se usa la versión 5 fijada en el lockfile.

1. Revisa y fusiona el PR. Usa un checkout actualizado de ese commit y entra en
   `server`. Coordina una ventana de mantenimiento y evita escrituras mientras
   verificas y concilias la base. Conserva las cinco migraciones anteriores
   exactamente como estaban. Si aparece una migración externa, fallida o un
   checksum cambiado, detente y revisa su SQL; no la marques a ciegas.
2. Configura en una sesión segura la conexión **directa** a Neon y SSL. Prisma
   toma `DATABASE_URL`; `pg_dump` toma `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`,
   `PGSSLMODE` y una contraseña suministrada por un gestor de secretos o archivo
   de credenciales protegido. Ambas conexiones deben apuntar a la misma base y
   esquema `public`. No imprimas estas variables ni pases contraseñas en los
   argumentos. No edites ni subas `.env`. Instala dependencias desde el lockfile
   si es necesario (`npm ci`).
3. Respalda antes de cualquier escritura. Ejemplo PowerShell con `pg_dump` de
   una versión compatible con el servidor:

   ```powershell
   $qaBackup = Join-Path $env:USERPROFILE ("backup-tecruta-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump")
   pg_dump --format=custom --no-owner --no-acl --file=$qaBackup
   if ($LASTEXITCODE -ne 0) { throw "Falló el respaldo; detenerse" }
   pg_restore --list $qaBackup | Out-Null
   if ($LASTEXITCODE -ne 0) { throw "Respaldo ilegible; detenerse" }
   ```

   Guárdalo fuera de Git, con acceso restringido: contiene datos personales.
   La lista valida que el archivo es legible; comprueba además que se restaura
   en una base desechable antes de usarlo como garantía de recuperación.
4. Revisa el historial y la estructura, sin modificar datos:

   ```powershell
   npx --no-install prisma migrate status --schema prisma/schema.prisma
   npx --no-install prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```

   En la consola SQL de Neon revisa el historial completo (sin datos de clientes):

   ```sql
   SELECT migration_name, checksum, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   ORDER BY started_at;
   ```

   Para comparar los checksums con los archivos del checkout (SHA-256):

   ```powershell
   Get-ChildItem prisma/migrations -Directory | ForEach-Object {
     Get-FileHash (Join-Path $_.FullName "migration.sql") -Algorithm SHA256
   }
   ```

   Tras incorporar este PR habrá **seis** migraciones en Git. Si el nuevo nombre
   todavía no está registrado, `status` puede indicar una pendiente aunque el
   diff estructural sea vacío. Tus resultados previos con cinco migraciones y
   diff vacío son compatibles con este caso; no demuestran que `legacy` esté
   correctamente marcado ni explican cómo se añadieron los objetos.
5. Elige el caso correcto:

   **A. La base solo tiene el esquema de las cinco migraciones.** El diff debe
   proponer exclusivamente los objetos enumerados arriba y el historial debe
   corresponder a las cinco anteriores completadas. Revisa que no propone
   borrados ni cambios adicionales. No uses `resolve`: pasa al deploy del paso
   6, que ejecutará la nueva migración y su actualización `legacy`.

   **B. La estructura ya coincide con `schema.prisma` (diff vacío).** Comprueba
   también los datos. Ejecuta esta consulta de solo lectura en Neon:

   ```sql
   WITH expected(slug) AS (
     VALUES ('power-banks'), ('cargadores'), ('cables'), ('audifonos'),
            ('accesorios'), ('celulares'), ('tablets'), ('laptops')
   )
   SELECT e.slug, c.id, c.legacy,
          CASE WHEN c.id IS NULL THEN 'FALTA: revisar'
               WHEN c.legacy THEN 'OK'
               ELSE 'NO marcar como aplicada' END AS resultado
   FROM expected e
   LEFT JOIN categories c ON c.slug = e.slug
   ORDER BY e.slug;
   ```

   Solo si las ocho filas dan `OK`, el historial anterior es correcto y la
   nueva migración aún no está registrada, marca **esta** como aplicada:

   ```powershell
   npx --no-install prisma migrate resolve --applied 20261012000000_add_nav_brands_stores_saved_items --schema prisma/schema.prisma
   if ($LASTEXITCODE -ne 0) { throw "Falló resolve; detenerse" }
   ```

   `resolve` escribe el historial, **no ejecuta** el SQL ni marca categorías.
   Si hay categorías con `legacy = false` o ausentes, detente: hace falta una
   conciliación específica revisada y autorizada antes de marcarla. No ejecutes
   la migración completa contra tablas ya existentes ni un seed para intentar
   solucionar la diferencia. Si la nueva migración ya figura completada y su
   checksum coincide con el archivo, omite `resolve`.

   **C. La estructura coincide parcialmente o hay otros cambios.** Detente y
   compara cada objeto y el historial. Este procedimiento no autoriza borrar
   datos, ignorar fallos ni reparar automáticamente diferencias desconocidas.
6. Solo después de completar las verificaciones del caso elegido:

   ```powershell
   npx --no-install prisma migrate deploy --schema prisma/schema.prisma
   if ($LASTEXITCODE -ne 0) { throw "Falló deploy; detenerse" }
   npx --no-install prisma migrate status --schema prisma/schema.prisma
   npx --no-install prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```

   Espera historial al día, diff vacío y las ocho categorías con `legacy = true`
   al repetir la consulta anterior. En el caso B, deploy no debe intentar crear
   los objetos de esta migración. Verifica salud de API y navegación antes de
   reabrir las escrituras. No ejecutes seeds, `db push`, `migrate reset` ni
   `migrate dev` en producción.

## Riesgos y cómo revertir

- El DDL bloquea brevemente `categories` y `products` y el UPDATE cambia la
  clasificación de ocho categorías; probar y programar una ventana adecuada.
  No elimina registros, no toca precios/stock y no reasigna productos.
- Antes de aplicar: revertir el PR basta. Ningún archivo histórico se modificó.
- Si falla durante su transacción: PostgreSQL revierte los cambios de aplicación;
  Prisma puede dejar una entrada fallida en el historial. Revisar el error y el
  estado real antes de cualquier `resolve --rolled-back` y reintento. No borrar
  entradas del historial manualmente.
- Después de aplicar: un revert de Git no deshace la base. Conservar las tablas y
  columnas añadidas es la opción inicial con menor riesgo. Cualquier reversión
  de datos o restauración del respaldo requiere un plan aprobado, teniendo en
  cuenta escrituras posteriores. No se entrega un down destructivo.
- Después de `resolve` sobre objetos preexistentes: no borrar esos objetos ni
  registros para revertirlo. Investigar primero el historial y conservar el SQL
  aplicado; no renombrar ni editar migraciones ya registradas.

## Lo que no se probó

No se conectó a Neon para consultar su historial o ejecutar SQL. La evidencia de
producción son las salidas compartidas por el usuario; falta verificar allí las
ocho marcas `legacy`, checksums y el respaldo. No se ejecutaron migraciones,
seeds, escrituras, pedidos, subidas ni sesiones autenticadas en producción.
Las correcciones de pedidos, OAuth, dependencias y los cambios de Home de Claude
pertenecen a lotes posteriores y no se incluyen aquí.

Lote 2 listo. Escribe continuar para el Lote 3.
