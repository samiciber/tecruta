# Publicación pendiente de www.tecruta.com

Preparado el 16 de octubre de 2026. Este documento no autoriza migraciones,
merge a main ni despliegues. La versión candidata es el commit de
`revision/cambio-5a` que incorpora este documento; fijar su SHA completo desde
el resultado del push y usar exactamente ese código en API y frontend.
Si una integración posterior cambia el árbol, validar y registrar un nuevo SHA.

## Inventario y validación local

- Base revisada: `fc849fbd60f98f879629db84b1a02560f3ad4b73`.
- Incluir fuentes frontend/API de Home 5a/5b, footer/legal/newsletter 5c,
  esquema, SQL de newsletter, pruebas, fixtures sintéticos, guiones de QA
  reproducible y documentación funcional. Los lockfiles no cambiaron.
- Excluir `docs/lotes.zip`, `docs/lotes/evidencia-5a/`, `evidencia-5b/`,
  `evidencia-home-final/`: archivo comprimido y evidencia generada local.
- Excluir `docs/lotes/cierre-home-avance.md`, `cierre-home-cambios.json`,
  `cierre-home-revision.md` y `scripts/review-home-final-changes.mjs`: continuidad,
  inventario y herramienta ligados a un respaldo temporal fuera del repositorio.
  Las referencias a galerías en las guías anteriores son evidencia local,
  no artefactos incluidos en Git. Conservar todo lo excluido en disco.
- No incluir `.env`, credenciales, respaldos de bases, dependencias ni `dist/`.
- QA actual: login desde UI con contraseña sintética usando el router real;
  acceso ADMIN a Home, preview, footer y suscriptores; carrito y guardados
  reales. Sin errores JavaScript. PostgreSQL creado y eliminado exclusivamente
  para la prueba. Sin conexiones a bases existentes ni lectura de `.env`.
- 27/27 pruebas de Home/footer y regresión de caché/compra; 1/1 integración
  compuesta PostgreSQL (persistencia, preview, autorización y newsletter).
- Build aprobado con `build({ envFile: false })`; `git diff --check` aprobado.
  Avisos pendientes: import mixto de departamentos y chunk 3D de más de 500 kB.
- Los guiones de navegador requieren Edge y `playwright-core` en la ubicación
  temporal documentada en su código. Es infraestructura QA, no dependencia de
  producción. No ejecutar fixtures ni seeds QA contra bases existentes.

## Requisitos previos del operador

1. Obtener autorización de publicación. Mantener despliegues automáticos
   desactivados; comprobar también hooks y acciones CI que puedan desplegar.
   No se inspeccionó ni modificó la configuración remota de Render/Vercel.
2. Registrar SHA, ID/URL del despliegue anterior de cada servicio y su
   configuración, sin copiar secretos al repositorio. Confirmar que ambos
   artefactos anteriores siguen disponibles para rollback.
3. Confirmar respaldo reciente de la base y restauración comprobada; tomar
   un respaldo previo a la ventana de migración y guardarlo fuera de Git.
4. En el gestor de secretos, confirmar configuración sin imprimir valores:
   DATABASE_URL, JWT_SECRET, NODE_ENV=production, CORS_ORIGIN para
   `https://www.tecruta.com`, TRUST_PROXY según la topología y variables de
   correo/Google/Cloudinary que se utilicen. Revisar la rotación de claves
   señalada en README. Confirmar dominio, DNS y TLS en Vercel.
5. Revisar contenido comercial, fotografías, enlaces/contactos y textos legales
   desde el admin. La newsletter registra suscriptores; no implementa envíos
   de campañas ni un proveedor de email marketing.

## Orden de actualización: base → API → frontend

Todos los comandos siguientes son para una ventana futura autorizada,
desde el checkout fijado al SHA candidato. No se ejecutaron en producción.

### 1. Base de datos

El estado real de las migraciones está **sin consultar**. El operador deberá
comparar `_prisma_migrations`, checksums, estructura y datos con el historial
del repositorio antes de escribir. Revisar también las cinco migraciones
históricas desde `20260831091611_init` hasta
`20260925071715_add_google_and_receipt` (esta última agrega campos 3D).

| Orden | Migración a contrastar | Efecto |
| --- | --- | --- |
| 1 | `20261012000000_add_nav_brands_stores_saved_items` | Navegación, marcas, tiendas, ajustes y guardados; marca categorías originales legacy |
| 2 | `20261012000001_add_order_receipt_token_idempotency` | Hash de comprobante e idempotencia de pedidos |
| 3 | `20261012000002_add_secure_auth_codes_oauth_sessions` | Códigos seguros, versión de sesión y tablas OAuth; invalida códigos antiguos en claro |
| 4 | `20261015000000_add_newsletter_subscribers` | Tabla de suscriptores, correo único y CHECK de normalización |

En `server/`, usar la CLI fijada por el lockfile: `npm ci`, después
`npx --no-install prisma migrate status --schema prisma/schema.prisma`.
Resolver discrepancias antes de continuar. Si los objetos de navegación ya
existen sin registro, seguir el procedimiento de `docs/lotes/lote-2.md`:
verificar estructura **y datos legacy** antes de considerar una resolución
aplicada. No marcar migraciones como aplicadas a ciegas ni modificar SQL histórico.

Solo con historial reconciliado, respaldo y autorización:
`npx --no-install prisma migrate deploy --schema prisma/schema.prisma`.
Este comando aplica todas las pendientes por orden, no solo newsletter.
Repetir status y verificar tablas/índices. Ante fallo, detener la publicación.
No usar `db push`, `migrate dev`, `migrate reset` ni ejecutar seeds de catálogo
o fixtures como parte de esta actualización.

### 2. API en Render

Preparar artefacto con Node compatible (`^20.19.0 || >=22`, según package.json),
raíz `server/`, `npm ci` y `npm run prisma:generate` sobre el esquema nuevo.
No reutilizar un cliente Prisma anterior: debe incluir NewsletterSubscriber.
Arrancar con `npm start`, después de completar las migraciones. Desplegar
manualmente el SHA fijado y conservar los despliegues automáticos desactivados.

Antes de actualizar frontend, comprobar `/api/health`, catálogo, navegación,
`/api/home`, `/api/footer` y ambos documentos `/api/legal/:type`.
Comprobar login ADMIN y CUSTOMER con cuentas autorizadas; endpoints admin
sin sesión deben devolver 401 y con CUSTOMER 403. Verificar logs y ausencia
de errores Prisma o columnas/tablas ausentes. Health por sí solo no prueba DB.

### 3. Frontend en Vercel

Usar el mismo SHA, raíz del proyecto, `npm ci`, `npm run build`, salida `dist`.
Configurar `VITE_API_URL` con la API pública antes de compilar; es una variable
pública. Confirmar que `vercel.json` permite ese host en CSP (actualmente
`https://tecruta.onrender.com`) y que CORS permite el dominio canónico.
Comprobar un preview autorizado antes de promoverlo a `www.tecruta.com`;
si preview usa otro origen, preparar su API de pruebas con CORS compatible.

Verificar Home en móvil/escritorio, claro/oscuro; navegación directa y recarga
de rutas SPA; login/logout, acceso admin, guardado/recarga y preview sin escritura,
catálogo, stock/precios, carrito, guardados y checkout. Probar newsletter con un
correo de prueba autorizado: alta, duplicado, inválido, consentimiento, listado
y CSV ADMIN. Coordinar compras/correos de prueba para no generar efectos reales
inesperados. Confirmar HTTPS, CSP/CORS y logs sin nuevos errores.

## Volver al despliegue anterior

Si falla una comprobación, detener la promoción. Restaurar primero el frontend
anterior en Vercel y luego, si el fallo es de API, el artefacto anterior de Render;
repetir salud, login, catálogo y admin. Mantener automatismos desactivados.
Usar los IDs registrados, no asumir que el HEAD base era lo desplegado.

La reversión de código no revierte migraciones ni ediciones de contenido.
La tabla nueva de newsletter es aditiva y debe conservarse con sus registros.
Evaluar compatibilidad del backend anterior con las migraciones heredadas;
los códigos antiguos borrados por la migración de seguridad no se recuperan
con rollback de código. No eliminar columnas/tablas para volver atrás.
Si hubiera daño de datos, restaurar en una base aparte, verificarla y coordinar
el cambio de conexión y la recuperación de escrituras posteriores con el operador.

Referencias operativas: [despliegues Render](https://render.com/docs/deploys),
[rollback Render](https://render.com/docs/rollbacks) y
[Instant Rollback Vercel](https://vercel.com/docs/instant-rollback).
