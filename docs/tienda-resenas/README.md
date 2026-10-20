# Rediseño y reseñas verificadas

Rama `feature/rediseno-tienda-resenas`, desde `main` actualizado `7d14d11`. Publicado el 20 de octubre de 2026 desde esta rama, sin merge a main. [Informe de publicación y recuperación](publicacion-20261020/README.md). No se leen archivos `.env`; PostgreSQL QA aislado mediante los helpers existentes.

## Decisiones de alcance

- Se conserva el orden del CMS y sus campañas reales. Una cuenta regresiva aparece únicamente con fecha de fin real; no se inventan ofertas, beneficios, reseñas ni políticas. Máximo tres diapositivas visibles.
- La excepción a «no tocar el panel» es exclusivamente la página ADMIN de moderación y la configuración comercial solicitadas. POS, caja y pedidos no cambian.
- La compra elegible es una línea de pedido web asociado a la cuenta CUSTOMER y actualmente DELIVERED. No se vinculan ventas anónimas ni POS retrospectivamente. Una reseña por cliente/producto, aunque vuelva a comprarlo. Una rechazada sigue ocupando esa compra y puede aprobarse posteriormente.
- La identidad pública usa nombre e inicial del apellido; no expone correo ni identificadores de compra/usuario. Los votos son de clientes autenticados, no del autor.
- Se conservan reseñas e invitaciones al retirar la función: recuperación mediante desactivar rutas/UI y volver al código compatible con las columnas adicionales. No se eliminan tablas.
- Las reseñas no introducen almacenamiento de tokens. La autenticación existente permitía recordarlos en localStorage; para cumplir el criterio explícito se limita ese helper a sessionStorage, sin cambiar endpoints, Google, roles ni emisión de tokens. Las sesiones persistentes anteriores deben iniciarse otra vez.

## Revisar en este equipo

Con Docker Desktop iniciado, desde este worktree:

```powershell
npm.cmd run preview:reviews
```

- Accesos y credenciales QA efímeras: http://127.0.0.1:5201/revision-local.
- Tienda: http://127.0.0.1:5201/ y `/catalogo`.
- Producto con reseñas: http://127.0.0.1:5201/producto/qa-producto-0#resenas.
- Moderación: http://127.0.0.1:5202/resenas, o Más → Catálogo → Reseñas de productos.
- Datos comerciales: http://127.0.0.1:5202/datos-comerciales.

El lanzador crea PostgreSQL desechable, instala las migraciones allí y genera usuarios, productos y opiniones inequívocamente sintéticos. Su contraseña es aleatoria, solo aparece en la página local y cambia con cada ejecución. Los correos están interceptados y las credenciales de proveedores quedan deshabilitadas. Cierra con Ctrl+C para retirar el contenedor. No subir esta base, importar sus datos al negocio ni usar este lanzador en producción. Los archivos de prueba no forman parte del bundle del sitio.

## Uso

El cliente puede opinar después de una compra web entregada realizada con su cuenta verificada. En la ficha verá el formulario o un motivo concreto por el que aún no puede opinar. El envío queda PENDING; no cambia la calificación pública. La misma persona no puede opinar otra vez sobre ese producto, incluso con otra compra o tras un rechazo. El voto útil es de una sola vez por cuenta y reseña; repetir la solicitud conserva el contador. El autor no puede votarse.

Solo ADMIN modera. Aprobar o rechazar cambia los totales de producto en una transacción con bloqueo; repetir el mismo estado no vuelve a sumar/restar. El motivo de rechazo es obligatorio y privado. La respuesta de tienda aparece junto a la reseña aprobada; tanto cambios de estado como respuestas quedan en la auditoría existente. No se crean roles o cuentas especiales. Almacén y cajero no reciben estas herramientas.

El listado público pagina por cursor, ordena por fecha o votos y filtra por estrellas. Promedio y distribución se calculan sobre todas las aprobadas, sin sesgo por filtro. Los listados de productos añaden únicamente `ratingCount` y `ratingSum`, sin cargar relaciones de reseñas. Sin reseñas no hay estrellas ni JSON-LD de calificaciones. La portada muestra hasta seis opiniones recientes de cualquier nota y solo desde tres aprobadas. Puede añadirse, moverse o desactivarse desde Portada y distribución → Opiniones verificadas. En configuraciones anteriores, sin ese bloque explícito, aparece al final únicamente si hay suficientes reseñas.

La tienda conserva el CMS, precios, carrito, buscador, pagos, pedidos y sus verificaciones. El hero muestra como máximo tres slides. Las campañas mantienen su fecha real; no aparece una cuenta regresiva inventada. Cloudinary se optimiza con una etapa final de formato/calidad/tamaño, conservando recortes anteriores; las URLs firmadas no se alteran. La hoja de estilo está limitada a StoreRoot y no se carga en el POS/panel.

## Completar antes de operar

En Más → Configuración → Datos comerciales, el dueño debe confirmar y completar:

- Razón social y RUC.
- Dirección comercial.
- URL HTTPS del Libro de Reclamaciones.
- Condiciones de garantía.
- Plazos y condiciones de envío.
- Beneficios realmente ofrecidos, si desea mostrarlos.

Se guardan en `SiteSetting.storeBusiness`, usando la validación ADMIN existente. Los campos vacíos no generan bloques públicos. WhatsApp, contacto, enlaces del pie y métodos de pago siguen viniendo de su configuración existente; revisar que esos datos anteriores estén vigentes. No se asignan datos legales ni políticas por defecto en la configuración nueva.

## Validación y publicación

- [Resultados y límites comprobados](validacion/README.md).
- [Migración, publicación y recuperación](publicacion-recuperacion.md).
- [Capturas locales](capturas/README.md).

La función queda implementada para revisión local. **No se certifica el criterio de batería global completamente verde:** los 57 fallos heredados también se reproducen en la base sin estos cambios. Deben conciliarse antes de autorizar publicación. Tampoco se corrigieron cinco avisos altos anteriores de dependencias de la tienda porque esta entrega prohíbe cambiar versiones. No se ha publicado ni ejecutado ninguna migración en producción.

## Ajuste de opiniones compactas

Resumen con promedio de 32 px y título de 24 px; comentarios y filtros plegados inicialmente. El botón Ver opiniones / Ocultar opiniones informa su estado con aria-expanded. La paginación solicita tres reseñas por lote y conserva filtros y votos al plegar. Verificado abrir/cerrar en navegador local, ambos builds, cinco pruebas unitarias y diff --check. Evidencia: capturas/opiniones-compactas.jpg.

La publicación posterior fue autorizada y ejecutada con respaldo previo y comprobación del historial de migraciones. Los 57 fallos heredados y los límites de validación se conservan documentados en el informe de publicación. Este ajuste visual no agregó otra migración.

Estado final: rediseño y reseñas publicados en tienda/API/panel. Ver publicacion-20261020/README.md para versiones, respaldo y pendientes reales.
