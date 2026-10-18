# Publicación y recuperación del sistema integrado

**Publicación solicitada; ventana de escrituras pospuesta por el titular.** El
18 de octubre el titular eligió «Prepara todo y acordamos otro horario». No
publicar ni migrar hasta acordar esa ventana. Ver [preparación comprobada](preparacion-publicacion.md).
No ejecutar
este procedimiento como parte de las pruebas locales. No copiar fixtures QA a
Neon ni generar ventas para comprobar accesos. El despliegue actual permanece
operativo y no fue modificado durante esta etapa.

## Preparación

1. Fijar un commit de `implementacion/sistema-personal-integrado`, comprobar las
   pruebas y ambos builds. Registrar versiones/IDs de API, tienda y panel en
   producción; mantener automatismos desactivados mientras se coordina el corte.
2. Respaldar PostgreSQL/Neon fuera del repositorio y comprobar la restauración
   en una base aislada. Registrar productos, stock por producto, pedidos por
   estado y usuarios. No imprimir secretos ni hashes de contraseñas.
3. Comparar `_prisma_migrations`, checksums y esquema. Si la base conserva el
   acceso publicado, el alias `20261018000000_admin_login_alias` ya estará
   aplicado: no se vuelve a ejecutar. Las pendientes esperadas son:

   | Migración | Efecto |
   | --- | --- |
   | `20261017000000_inventory_part1` | SKU, códigos, Kardex y un saldo inicial por producto, sin cambiar cantidades ni inventar costos |
   | `20261017010000_pos_part2` | Ventas, pagos, devoluciones, caja e índices de búsqueda |
   | `20261019000000_staff_credentials_security` | Correo opcional, usuarios de personal, sesiones, auditoría, contraseña temporal y configuración MFA |

   El orden de fechas de las dos pendientes de inventario anteriores al alias
   ya aplicado no implica volver a aplicar el alias. Usar el historial real;
   abortar si aparecen otras pendientes o migraciones fallidas.
4. Comprobar ausencia de stock negativo y disponibilidad de `pg_trgm`. No usar
   `db push`, `migrate reset`, `migrate dev` ni seeds en producción. No cambiar
   proveedor de base ni versiones de React/Express/Prisma/PostgreSQL.
5. Revisar que el titular conserva su alias y correo de recuperación. La nueva
   migración revoca sesiones antiguas de personal y exige cambiar contraseña al
   ingresar; no altera contraseñas existentes, Google IDs ni sesiones CUSTOMER.
   Los administradores antiguos sin alias deben recibir uno explícito mediante
   el procedimiento ya existente y, si procede, una temporal desde el titular.
6. Preparar `MFA_ENCRYPTION_KEY` en el gestor de secretos si se habilitará TOTP;
   generar 32 bytes aleatorios en base64 fuera de Git. Conservar Resend y sus
   secretos para recuperación del titular/clientes. El personal no usa Resend.

## Corte de inventario: no prometer un despliegue sin interrupción de escrituras

La migración inicial del Kardex necesita un instante coherente: bloquear productos,
registrar saldos y activar la comprobación de stock/movimiento. La API publicada
anterior no escribe Kardex. **No es compatible mantenerla vendiendo o editando
stock después de esa migración.** Hace falta acordar una ventana breve de corte
de escritores o desarrollar y revisar previamente una transición adicional por
fases. Esa decisión requiere aprobación operativa antes de publicar.

La tienda puede seguir mostrando catálogo durante una ventana de escrituras
coordinada. No se incluye ni se activa un bloqueo global de `/api` en esta rama.
No detener compras ni desplegar la versión nueva sin haber acordado el mecanismo
del corte; no basta ocultar botones. Deben contemplarse checkout, cancelaciones,
editor de productos, scripts y todas las instancias viejas que puedan escribir.

Con la ventana autorizada y escritores coordinados:

1. Ejecutar `scripts/deploy/pause-inventory-writes.sql` mediante una conexión
   directa y con `ON_ERROR_STOP`. Sus disparadores bloquean en PostgreSQL las
   altas/bajas de productos, cambios de stock y escrituras en pedidos/detalles,
   incluso desde instancias antiguas. No bloquean las consultas del catálogo.
   La instalación es atómica; si vence el límite de bloqueo, abortar sin migrar.
   Las escrituras afectadas fallan y revierten sus transacciones; no quedan
   compras en cola que se confirmen automáticamente al reabrir. La API antigua
   puede mostrar un error genérico: avisar de la ventana antes del corte.
   Tomar entonces un respaldo final consistente y registrar el corte. El
   respaldo de preparación no sustituye este respaldo final.
2. Desde el checkout aprobado y una conexión directa al mismo Neon, ejecutar
   `prisma migrate status` y después `prisma migrate deploy` con el CLI fijado.
   Definir límites de espera de bloqueo y tiempo acordes al tamaño de la base.
   Nunca modificar archivos SQL históricos ni marcar migraciones aplicadas a ciegas.
3. Generar Prisma y desplegar la API integrada. El código nuevo requiere las
   tablas y columnas nuevas; no desplegarlo antes de migrar. No mantener API vieja
   y nueva escribiendo simultáneamente. Reiniciar la API con las variables reales,
   sin copiar archivos `.env` locales al hosting.
4. Comprobar saldos iniciales únicos, mismos productos/existencias y costos
   iniciales NULL; ningún pedido/venta/caja QA. Comprobar API, CORS, login y permisos
   con cuentas autorizadas, sin crear movimientos comerciales ficticios.
5. Publicar panel (`npm run build:panel`, `dist-panel`) y tienda
   (`npm run build:store`, `dist`) con el mismo commit. Conservar los orígenes
   exactos de CORS, `STORE_ORIGIN`, `PANEL_ORIGIN`, `VITE_API_URL`,
   `VITE_STORE_ORIGIN` y `VITE_PANEL_ORIGIN`. No permitir comodines de Vercel.
6. Reabrir escrituras con `scripts/deploy/resume-inventory-writes.sql` únicamente
   cuando toda la API compatible esté activa y verificada. Comprobar que no
   quedan disparadores `tecruta_cutover_%`. Antes de migrar puede usarse el mismo
   SQL para abortar el corte; después de migrar no reabrir con la API antigua.
   Vigilar rechazos de stock, idempotencia, errores Prisma y conciliación del
   Kardex. El titular cambia su contraseña y prepara las cuentas de trabajadores.
7. Conectar `admin.tecruta.com` solo en un paso posterior autorizado con acceso
   DNS y HTTPS validado; no es requisito de la revisión ni de los usuarios.

## Recuperación que conserva ventas y movimientos

- Antes de aplicar inventario, puede conservarse la versión publicada actual.
  Si una migración falla, consultar el estado y diagnosticar; no resetear la base.
- Después de migrar inventario **no volver al backend anterior sin Kardex**.
  Mantener el backend compatible o aplicar una corrección hacia adelante. Un
  rollback de frontend solo es válido si conserva los contratos de la API.
- No borrar tablas de ventas/caja, revertir stock manualmente ni restaurar un
  dump antiguo sobre compras nuevas. Conservar todas las escrituras posteriores
  al corte. Si se necesita restauración, hacerlo en otra base, conciliar pedidos,
  pagos, stock y Kardex posteriores, y coordinar el cambio con responsables.
- Suspender una cuenta no borra historial. Cerrar una caja de un suspendido se
  hace por conciliación explícita del ADMIN con conteo y motivo; nunca mediante
  SQL que cambie silenciosamente el titular o los saldos.
- Respaldar por separado la clave MFA cifradora con control de acceso. Los
  códigos de respaldo del titular solo los conserva el titular. Correo no
  desactiva MFA: si se pierden todos los factores, requiere recuperación operativa
  de identidad verificada y con registro. No implantar una puerta de emergencia.

Limitaciones: no se ha ensayado el corte de producción, la impresión física, la
recepción real de correo ni una emisión SUNAT. Esos pasos requieren coordinación
externa; no se presentan como completados por las pruebas locales.
