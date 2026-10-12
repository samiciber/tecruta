# Lote 0 — diagnóstico de migraciones y secretos

Base revisada: main `8470fc155b22faba01bb467948d9ca8c615ce9e7`, después de fetch de origin/main. No había cambios desde H01–H35 en los archivos del Lote 1.

## Resultado

Las cinco migraciones versionadas aplican desde cero, pero dejan una BD incompatible con el esquema actual. H12 sigue pendiente de corrección; H01 sigue pendiente de revocación/rotación de las credenciales históricas confirmadas. Este lote diagnostica y documenta; no corrige la BD ni rota claves.

Se utilizó exclusivamente el contenedor desechable `tecruta-lote0-db`: PostgreSQL 16, usuario local `qa_lote0`, puerto 55432 en loopback, sin volumen de producción ni montaje de .env. Se aplicaron las cinco migraciones en `migration_history`; `migration_shadow` se usó para prisma migrate diff. Ambas operaciones finalizaron con exit 0.

## Diferencia exacta: historial → schema.prisma

El SQL completo generado está en [lote-0-migrations-diff.sql](lote-0-migrations-diff.sql), fuera de prisma/migrations. **Es evidencia, no una migración para producción**, y no se ejecutó para corregir ninguna BD.

Enum ausente: NavItemType = LINK, HEADING, DIVIDER, SUBMENU, PROMO.

Tablas nuevas y todas sus columnas:

| Tabla | Columnas |
|---|---|
| category_tiles | id, categoryId, title, image, href, position, visible |
| brands | id, slug, name, logo, featured, featuredPosition, visible, createdAt |
| nav_items | id, menuKey, parentId, type, label, href, position, visible |
| popular_searches | id, text, position, active |
| stores | id, name, address1, address2, city, postalCode, opensAt, active, isDefault, position |
| site_settings | key, value, updatedAt |
| saved_items | id, userId, productId, createdAt |

Columnas nuevas de tablas existentes:

| Tabla | Columnas y definición |
|---|---|
| categories | image TEXT nullable; legacy BOOLEAN NOT NULL DEFAULT false; parentId TEXT nullable; position INTEGER NOT NULL DEFAULT 0; sourceRef TEXT nullable; visible BOOLEAN NOT NULL DEFAULT true |
| products | brandId TEXT nullable |

Índices ausentes (además de las siete claves primarias de las tablas nuevas, detalladas en el SQL):

- category_tiles_categoryId_idx (categoryId)
- brands_slug_key UNIQUE (slug)
- nav_items_menuKey_position_idx (menuKey, position)
- nav_items_parentId_idx (parentId)
- saved_items_userId_productId_key UNIQUE (userId, productId)
- categories_parentId_idx (parentId)
- products_brandId_idx (brandId)

FK ausentes: categories_parentId_fkey; category_tiles_categoryId_fkey; nav_items_parentId_fkey; saved_items_userId_fkey; saved_items_productId_fkey; products_brandId_fkey. Acciones ON DELETE/ON UPDATE, tipos y valores por defecto completos constan en el SQL.

No falta googleId, receiptUrl ni las cuatro columnas 3D: las cinco migraciones sí las cubren. La carpeta `20260925071715_add_google_and_receipt` contiene únicamente enable3D/hotspots/model3DPoster/model3DUrl.

### Indicios de una migración local no subida

- No hay migración nav_brands_stores, ni equivalente, en main ni en los 21 commits alcanzables revisados.
- Falta en migrations el UPDATE categories SET legacy=true para las ocho categorías antiguas; seed-nav.js sí contiene la actualización de datos, pero no reemplaza DDL ni una migración.
- Esquema, seed y endpoints consumen tablas/campos que migrate deploy no crea.
- Esto es compatible con una migración no subida o con una sincronización por fuera de Migrate; **no demuestra cuál ocurrió**. No tengo acceso a la máquina del propietario ni a _prisma_migrations de producción.
- Antes del Lote 2, el propietario debe comprobar si existe ese archivo local y subirlo si corresponde. No se inventó una migración en este lote.

## Secretos: inventario sin valores

Se recorrieron los 21 commits alcanzables. No se autenticó con claves del historial ni se comprobó su vigencia contra proveedores.

| Tipo | Archivo y commits representativos | Acción |
|---|---|---|
| Resend: una clave histórica con formato del proveedor | server/.env.example; desde 1dff7f7e74de90aa5b5935b263383f4f4c0e1af0, también presente en b2221e60009538c65ca55ea61d84a3a258633d3d; presente en 16 commits | Revocar esa clave en Resend, emitir otra con permisos/dominio necesarios y actualizar el secreto del despliegue. Comprobar revocación y envío con la nueva configuración fuera de esta fase. |
| Google OAuth: un client secret histórico con formato del proveedor | server/.env.example; desde b2221e60009538c65ca55ea61d84a3a258633d3d; presente en 12 commits | Rotar el secreto OAuth en Google Cloud, actualizar el despliegue y retirar la clave anterior. Mantener/revisar client ID y callback sin cambiar innecesariamente el flujo. |

Corrección de precisión de H01: los JWT_SECRET históricos inspeccionados contienen indicaciones de cambiar/reemplazar y son plantillas; las asignaciones de Cloudinary y Google actuales tienen prefijos de plantilla. Las URLs de BD contienen contraseñas con apariencia de plantilla. Una cadena literal con contraseña no basta para afirmar que sea una credencial activa. No presento esas asignaciones como secretos operativos confirmados. Si alguna plantilla se usó como secreto real, debe sustituirse; para JWT también deben invalidarse sesiones, y para BD/Cloudinary rotarse las credenciales del servicio correspondiente.

No se alteró ningún .env ni .env.example. La limpieza de ejemplos pertenece a otro lote autorizado; limpiar el historial no revoca credenciales.

## Plan de limpieza del historial — preparado, NO ejecutado

1. Rotar/revocar primero las claves confirmadas. Coordinar una ventana con el propietario y el proceso que está cambiando la Home.
2. Inventariar ramas, etiquetas, PR abiertos, forks y clones. Guardar un espejo completo privado y verificable para recuperación; ese espejo seguirá conteniendo las claves antiguas.
3. En otro directorio, crear un clon mirror de trabajo. Instalar git-filter-repo por un canal verificado.
4. Opción a revisar: retirar del historial los archivos `.env.example` y `server/.env.example` con:
   `git filter-repo --path .env.example --path server/.env.example --invert-paths`.
   No ejecutar en este checkout ni publicar todavía. Esta opción elimina también plantillas útiles antiguas; restaurar después ejemplos seguros en un commit nuevo.
5. Alternativa: reemplazar únicamente cadenas secretas, mediante un archivo de reglas privado fuera del repo, nunca en línea de comandos, logs o PR. No se preparó un archivo con los valores.
6. Auditar todas las referencias del clon reescrito, revisar diferencias de contenido y comprobar build. Conservar mapeo de commits y validar etiquetas.
7. El propietario decide explícitamente si autoriza publicación del historial reescrito. **Las reglas actuales prohíben force-push: este plan no lo ejecuta ni lo autoriza.** Revisar procedimiento de GitHub para purgar referencias/cachés y evitar reintroducción desde clones/PR.
8. Los colaboradores vuelven a clonar o sincronizan cuidadosamente sus ramas. Resolver PR abiertos mediante el mapeo y sin perder cambios de Claude.
9. Verificar nuevamente que las claves revocadas ya no funcionan y que no quedaron en otros artefactos.

Riesgos: cambian SHAs y firmas, pueden romperse enlaces/PR y etiquetas, forks/clones/cachés conservan copias, y un colaborador puede reintroducir el historial. Mantener un respaldo privado no equivale a limpiar GitHub.

## Reproducir el diagnóstico local

Con Docker disponible y sin reutilizar una BD real:

```bash
docker run -d --name tecruta-lote0-db \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=qa_lote0 \
  -e POSTGRES_DB=migration_history -p 127.0.0.1:55432:5432 \
  postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d
docker exec tecruta-lote0-db pg_isready -U qa_lote0
docker exec tecruta-lote0-db createdb -U qa_lote0 migration_shadow
cd /workspace/tecruta
DATABASE_URL='postgresql://qa_lote0@127.0.0.1:55432/migration_history' \
  server/node_modules/.bin/prisma migrate deploy --schema server/prisma/schema.prisma
DATABASE_URL='postgresql://qa_lote0@127.0.0.1:55432/migration_history' \
  server/node_modules/.bin/prisma migrate diff \
  --from-migrations server/prisma/migrations \
  --to-schema-datamodel server/prisma/schema.prisma \
  --shadow-database-url 'postgresql://qa_lote0@127.0.0.1:55432/migration_shadow'
```

Esperar readiness antes de createdb. Si el puerto/nombre está ocupado, usar otro contenedor y ajustar ambas URLs locales explícitas. El diff no ejecuta cambios en la BD de aplicación; sí usa la BD shadow desechable.

## Archivos, riesgos y reversión

| Ruta | Cambio |
|---|---|
| docs/lotes/lote-0.md | Resultado, inventario de secretos, plan no ejecutado, pruebas y límites |
| docs/lotes/lote-0-migrations-diff.sql | DDL generado para revisión, sin registrar como migración |

No cambia comportamiento de aplicación ni activa el SQL. Reversión: revertir los commits de documentación si se integran; no requiere intervención en producción. Se destruye únicamente el contenedor desechable creado por esta prueba al finalizar.

No probado: estado de la máquina del propietario, estado real de migraciones en producción, vigencia/rotación de claves y limpieza de GitHub. Ningún H## queda corregido en este lote: H12 confirmado; H01 acotado y con rotaciones pendientes.

Lote 0 listo. Escribe continuar para el Lote 1.

