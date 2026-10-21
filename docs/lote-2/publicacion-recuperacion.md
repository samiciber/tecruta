# Publicación futura y recuperación

**No se ha publicado este lote, no se ha hecho push/merge a main y no se han
aplicado migraciones a producción.** Cada fase requiere aprobación posterior.
La tienda en operación conserva su versión y sus datos.

## Orden recomendado

1. Revisar código, capturas y deuda de pruebas. Resolver los 55 históricos antes
   de considerar una aprobación integral. Revisar textos comerciales y legales
   con el dueño. Mantener correos, monitoreo y analítica apagados.
2. En un entorno QA separado, restaurar una copia autorizada y anonimizada del
   esquema actual. Comprobar historial de migraciones, cantidades antes/después,
   tiempos de relleno e índices y compatibilidad. Nunca importar fixtures QA al
   negocio. No requiere cambio de dominio, base o alojamiento.
3. El operador autorizado prepara respaldo consistente, retención y prueba de
   restauración en otra base aislada. Registrar hora y conteos de pedidos,
   movimientos y envíos, sin guardar credenciales ni identificadores de
   infraestructura en el repositorio. Acordar una ventana por los locks del
   índice; no bloquear la API por anticipado ni usar MAINTENANCE_MODE antiguo.
4. Aplicar solo las dos migraciones nuevas, en orden; generar Prisma Client y
   publicar la API antes del frontend. En un checkout del release autorizado,
   desde server: `npx prisma migrate status`, `npx prisma migrate deploy` y
   `npx prisma generate`. Las credenciales las proporciona el entorno del
   operador, nunca un archivo de ejemplo del repositorio. No ejecutar estos
   comandos contra el negocio durante esta revisión.
   Conservar también la configuración de build existente (VITE_API_URL,
   VITE_STORE_ORIGIN y VITE_PANEL_ORIGIN), sin sustituirla por la del comparador QA.
5. Aprobar y publicar primero API/caché/búsqueda; comprobar health, lecturas,
   carrito y una operación QA aislada. Después SEO/funciones y frontend de
   tienda; verificar robots, sitemap, metadatos con User-Agent de rastreador y
   navegación normal. El panel mantiene su build separado.
6. Revisar remitente y cola antes de activar ORDER_EMAILS_ENABLED. Después, en
   aprobaciones separadas, configurar proveedores de telemetría y confirmar
   recepción real. Cupones quedan fuera. No se modifica DNS ni CORS para probar.

## Migraciones preparadas

| Migración | Aplica | Recuperación funcional |
|---|---|---|
| 20261021000000_order_email_outbox | Tabla de entregas, índices, FK y trigger sobre historial de estados; sin enviar ni rellenar pedidos históricos. | Apagar bandera/worker y volver a API anterior, conservando tabla, trigger y estados SENT/REVIEW. No borrar ni regenerar claves idempotentes. |
| 20261021010000_store_search | Tres columnas searchText, relleno, funciones/triggers e índices GIN. Originales, precios, stock y costos no cambian. Reutiliza pg_trgm existente. | Volver a frontend/API anterior y conservar columnas, índices y triggers. No hace falta deshacer físicamente el esquema. |

Ambas son transaccionales, aditivas y tienen lock_timeout de 5 s. Un timeout
aborta: investigar y reintentar en la ventana aprobada, no fingir que la
migración se aplicó. Si Prisma registra una ejecución fallida, el operador debe
comprobar primero el rollback completo; solo entonces usar migrate resolve
--rolled-back con el nombre exacto y repetir deploy. Nunca marcar aplicada una
migración sin verificar sus objetos y checksums.

La reversión recomendada es de código/banderas. No hay scripts DROP/DELETE de
negocio: retirar físicamente columnas o tablas perdería trazabilidad. Una
corrección de esquema debe ser otra migración revisada. Conservar el historial
original de Prisma; no modificar SQL ya aplicado ni ejecutar migrate reset.

## Incidentes sin perder ventas

Apagar primero el módulo optativo implicado. Revertir el código al release
anterior manteniendo la base expandida. El DTO completo por defecto sigue siendo
compatible; view=cards solo lo solicita el frontend nuevo. No volver a sembrar
productos, usuarios, saldos ni pedidos.

Un rollback de código no debe restaurar ciegamente un respaldo sobre ventas
posteriores. Si hiciera falta recuperar datos, restaurar en otra base, comparar
por claves e historial, conciliar todos los pedidos y movimientos posteriores
al respaldo y aprobar una reparación auditable. No borrar ventas, Kardex,
pagos ni registros de envío para ocultar el incidente. Los envíos inciertos se
concilian con el proveedor antes de reintentar fuera de su ventana idempotente.

## Variables nuevas

| Variable | Entorno y valor por defecto |
|---|---|
| ORDER_EMAILS_ENABLED | API/job, ausente = apagado |
| PUBLIC_API_ORIGIN | Funciones SEO; origen fijo de la API pública existente. Solo cambiar por configuración autorizada. |
| SEO_STORE_ORIGIN | Funciones SEO; tienda pública existente por defecto. Un preview requiere QA independiente. |
| ERROR_MONITOR_DSN | API, ausente = apagado |
| FRONTEND_ERROR_MONITOR_DSN | API, receptor de errores de tienda, ausente = apagado |
| VITE_ERROR_MONITOR_DSN | Build de tienda, ausente = no importa módulo de errores |
| VITE_ANALYTICS_DOMAIN | Build de tienda, ausente = no importa módulo de analítica |
| PLAUSIBLE_DOMAIN / PLAUSIBLE_ENDPOINT | API, ambos necesarios; ausentes = apagado |

Resend, remitente y configuración comercial reutilizan las variables/campos
existentes; ver fase-1-correos.md. SEO público funciona por defecto porque no es
un proveedor de telemetría; sus overrides son opcionales. No hay claves de pago,
credenciales, DSN reales ni configuración de negocio en estas instrucciones.
