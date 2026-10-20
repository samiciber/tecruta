# Migración, publicación y recuperación

Preparado el 20 de octubre de 2026, America/Lima. Aplicado bajo autorización posterior del titular el mismo día. Ver el [registro de publicación](publicacion-20261020/README.md). Se publicó la rama sin fusionarla con main; se conservan abajo las instrucciones de preparación y recuperación.

## Preparación

1. Revisar la rama `feature/rediseno-tienda-resenas` y el [informe de validación](validacion/README.md). Resolver o conciliar los 57 fallos heredados y el estado de dependencias antes de aceptar la entrega como completamente validada. Las pruebas nuevas sí pasan.
2. Registrar versiones vigentes de API, tienda y panel. Conservar respaldo protegido y comprobado de PostgreSQL y de `site_settings`; el operador autorizado debe hacerlo con su gestor de secretos, sin copiar credenciales al chat, logs ni repositorio. Los usuarios y ventas no se exportan a este entorno QA.
3. Ensayar el upgrade sobre una copia desechable autorizada y medir duración de índices con volumen representativo. El ensayo de esta entrega utilizó solo PostgreSQL local y datos sintéticos.
4. Confirmar que el historial aplicado llega a `20261019000000_staff_credentials_security`. Las migraciones anteriores se conservan idénticas. La única nueva es `20261020000000_product_reviews`.

## Qué agrega la migración

Enum de estado, tablas `product_reviews`, `review_helpful_votes`, `review_invitations`; columnas enteras `products.ratingCount`/`ratingSum` inicialmente cero, índices y restricciones. La calificación SQL admite solo 1 a 5; título/texto tienen límites y el rechazo exige motivo. Se conservan cuentas, cantidades, costos, ventas y movimientos. Las reseñas, votos y vínculos tienen claves únicas y referencias con RESTRICT.

Incluye índices aditivos de las líneas y el historial de pedidos para leer elegibilidad y fecha de entrega; no cambia la lógica ni los estados del pedido. La migración usa BEGIN/COMMIT y un tiempo máximo de espera de bloqueo de cinco segundos. Los índices normales pueden retener bloqueos durante su creación: el ensayo local no demuestra la duración con el tamaño real del negocio. No ejecutar automáticamente un corte de la API ni activar mantenimiento por este documento; acordar la ventana necesaria según la medición.

## Aplicar cuando se autorice

Desde un checkout de la entrega revisada y con la conexión correcta inyectada por el gestor de secretos, no desde un archivo de pruebas:

```powershell
Set-Location server
npm.cmd ci
npm.cmd exec -- prisma migrate status --schema prisma/schema.prisma
npm.cmd exec -- prisma migrate deploy --schema prisma/schema.prisma
npm.cmd exec -- prisma generate --schema prisma/schema.prisma
Set-Location ..
npm.cmd ci
npm.cmd run build:all
```

No usar `migrate reset`, `db push` ni ningún seed en el negocio. No modificar archivos de migraciones aplicadas. Si hay deriva o una migración desconocida, detener el procedimiento y revisar; no hacer baseline a ciegas.

Desplegar primero la API con su Prisma Client regenerado, después tienda y panel. Mantener el CORS actual limitado a sus orígenes autorizados; no necesita comodines ni un origen nuevo. No cambiar DNS, Neon, alojamiento, autenticación Google ni cuentas. La API anterior puede seguir funcionando mientras se agrega el esquema; la API nueva requiere que las columnas ya existan.

Comprobar salud, listado/detalle de productos y que sin reseñas no se inventen estrellas. Revisar la ruta de moderación con una cuenta ADMIN existente. No crear compras, reseñas ni votos ficticios en producción para verificar la publicación. Las sesiones persistentes antiguas requieren iniciar sesión nuevamente; desde esta entrega los bearer tokens se guardan solamente en sessionStorage.

Comprobación de consistencia de lectura, sin modificar datos:

```sql
SELECT p.id, p."ratingCount", p."ratingSum", COALESCE(r.n,0) AS approved_count,
       COALESCE(r.total,0) AS approved_sum
FROM products p
LEFT JOIN (
  SELECT "productId", COUNT(*) AS n, SUM(rating) AS total
  FROM product_reviews WHERE status='APPROVED' GROUP BY "productId"
) r ON r."productId"=p.id
WHERE p."ratingCount" <> COALESCE(r.n,0)
   OR p."ratingSum" <> COALESCE(r.total,0);
```

Debe devolver cero filas. Ante diferencias, conservar datos y auditoría e investigar; no editar contadores manualmente durante actividad.

## Invitaciones por correo: desactivadas

Variables nuevas:

| Variable | Valor por defecto | Uso |
|---|---|---|
| `REVIEW_INVITATIONS_ENABLED` | apagado | Solo el texto exacto `true` habilita el script. |
| `REVIEW_INVITATION_DAYS` | `7` | Entero 1–90, días completos desde el último registro DELIVERED. |

Reutiliza `STORE_ORIGIN`, `RESEND_API_KEY` y `EMAIL_FROM`. No solicitar ni incorporar sus valores reales a la entrega. El remitente/dominio deben estar habilitados por el proveedor antes de activar el envío. No hace falta proveedor nuevo ni dependencia adicional.

Programar, solo después de aprobar contenido y habilitar variables, un job diario en el mismo entorno de API:

```text
node server/scripts/review-invitations.mjs
```

Ejemplo de horario: `0 14 * * *` si el planificador utiliza UTC (09:00 America/Lima), o `0 9 * * *` si admite configurar America/Lima. El script no carga `.env` y con la variable apagada no conecta a la base ni envía correo. El lote se limita a 100 líneas elegibles; dimensionar frecuencia si se supera ese volumen. Pedidos sin fecha DELIVERED en el historial se omiten, sin inventar fechas.

Cada invitación conserva una clave persistente; el proveedor recibe Idempotency-Key y se registra `sentAt` solo con una respuesta real que contenga identificador. El job usa bloqueo por línea y evita volver a invitar productos ya reseñados. Si falla conexión/confirmación, la misma clave permite reintentar únicamente dentro de 23 horas desde el primer intento. Fuera de esa ventana queda para conciliación manual y no vuelve a enviarse automáticamente. Este margen respeta la [ventana de idempotencia documentada por Resend](https://www.resend.com/changelog/idempotency-keys). No borrar ni reiniciar intentos inciertos; verificar el estado real en el proveedor antes de registrar un envío confirmado. No se ha enviado ningún correo real en estas pruebas.

## Recuperar conservando datos

1. Apagar invitaciones y retirar su programación. Si hay incidentes de moderación, suspender solo esas rutas mediante la configuración de despliegue/gateway o retirar el código de reseñas, conservando la operación comercial.
2. Guardar el `homeLayout` actual. Antes de volver al backend antiguo, quitar exclusivamente las secciones de tipo `reviews` del layout mediante el CMS de esta versión: el validador antiguo no reconoce ese tipo. Conservar una copia para reactivarlas luego. La tienda anterior simplemente omite el bloque de opiniones y los campos comerciales nuevos.
3. Recuperar los binarios anteriores de API/frontends usando el esquema expandido. **No revertir físicamente la migración:** las columnas adicionales no impiden ejecutar la versión anterior y los vínculos protegen la trazabilidad. No eliminar tablas, reseñas, votos, intentos, ventas ni movimientos. Una restauración general del respaldo perdería operaciones posteriores y no es el rollback adecuado para esta función.
4. Si la migración falla por espera de bloqueo, comprobar que PostgreSQL revirtió íntegramente la transacción. Revisar el registro de Prisma antes de resolver un intento como rolled-back y volver a intentarlo en otra ventana; no marcarla aplicada sin comprobar el esquema.
5. Al rehabilitar, desplegar el código compatible, comprobar contadores y restaurar las secciones del CMS guardadas. Las opiniones se conservan con su estado y auditoría originales.

Las reseñas ya publicadas pueden pasar a REJECTED mediante moderación si corresponde, dejando motivo y auditoría; no se borran para ocultar una corrección. Cambiar a versiones anteriores no exige retroceder el inventario ni el Kardex.

Referencia para optimización sin alterar recortes: [transformaciones encadenadas de Cloudinary](https://cloudinary.com/documentation/image_transformations#chained_transformations). Las URLs firmadas se conservan y requieren regeneración autorizada si se quieren optimizar.
