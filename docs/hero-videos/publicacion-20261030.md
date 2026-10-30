# Publicación autorizada: 30 de octubre de 2026

Autorización: «ahora si publica todo lo modificado».

## Estado comprobado

- Código funcional preparado: `6d1e1d3`, rama
  `feature/panel-credenciales-administradas`, subida a GitHub.
- Incluye video del Hero, lista administrativa de 25 productos por página,
  contraste del buscador/formularios y contraseñas asignadas por administrador.
- 61 pruebas unitarias y 78 de integración correctas, ambos builds correctos,
  sintaxis correcta, lint sin errores y `git diff --check` limpio. Datos sintéticos
  y PostgreSQL local desechable. No hay migraciones nuevas.
- Producción sigue con API `9fef5258139e437e7f687818659f065a4c2fe4c6`.
  Health, tienda, panel, catálogo y Home responden 200; personal sin sesión, 401.
  El panel mantiene `noindex, nofollow, noarchive` y caché privada.
- El push inició compilaciones automáticas de Vercel para la rama. No se
  promovieron a producción y no sustituyen el despliegue previo de la API.

## Dependencia pendiente

El control de navegador devuelve `The browser access host is unavailable`.
No hay sesión de Vercel CLI configurada ni una herramienta conectada de Render.
Por tanto, no se ha desplegado la API ni promovido tienda/panel. Se solicitó
restablecer la conexión del navegador con las sesiones de Vercel y Render.
No faltan otra autorización de publicación ni contraseñas por chat.

La revisión visual y reproducción real del video siguen pendientes; no se
presentan los builds ni las pruebas de API como evidencia visual. La carga a
Cloudinary real tampoco se ha probado con archivos comerciales.

## Continuación

1. Confirmar los despliegues activos y conservar sus referencias para rollback.
   La referencia previa de tienda en Vercel es `528R255LeChnA5WpiaQtsPo3MZKU` y
   la del panel `6mFzCsrEg6jcS5HzTAbU7GrjaTwU`, asociadas a `9fef525`.
2. En Render desplegar el SHA funcional de esta rama, conservando build,
   variables, CORS, origen y base existentes. No ejecutar migraciones, seeds,
   cambios de cuentas ni ventanas de mantenimiento para este lote.
3. Esperar a que `/api/health` devuelva la revisión nueva. Comprobar catálogo,
   Home y autorización sin generar ventas ni cambios de negocio de prueba.
4. Publicar tienda y panel en sus proyectos actuales con configuración de
   **producción**, sus builds separados y las plantillas de `deploy/`. No promover
   a ciegas un preview compilado con variables de otro entorno. El panel nuevo
   envía `password`, que requiere la API nueva primero.
5. Comprobar recursos, CSP `media-src`, noindex del panel y CORS limitado a
   los orígenes existentes; revisar buscador oscuro, paginación y credenciales.
   La prueba completa de creación/reset se mantiene en QA, sin crear personal
   ficticio ni cambiar contraseñas reales para verificar la publicación.
6. Registrar despliegues y resultado real. No cambiar DNS, dominio ni alojamiento.

## Recuperación

Revertir los despliegues de código juntos si falla la comprobación. Conservar
todos los datos y auditoría; no restaurar una base antigua encima de operaciones
posteriores. Las nuevas credenciales son hashes compatibles, pero la API anterior
volvería a crear contraseñas temporales al dar altas o restablecerlas.

Antes de retirar el soporte de video, volver esos banners a imagen desde el
panel nuevo conservando sus URLs y portadas: una API antigua puede descartar
campos de video al guardar. No se configuraron videos de negocio durante QA.
