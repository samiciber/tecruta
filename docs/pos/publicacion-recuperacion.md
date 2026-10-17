# Publicación y recuperación — procedimiento pendiente

**Ninguno de estos pasos se ejecutó en producción.** No cambiar dominio, DNS ni alojamiento. Las bases QA y los datos de capturas son desechables; nunca deben copiarse al negocio.

La separación posterior autorizada está preparada únicamente de forma local en [Panel TecRuta](../panel/README.md). Su procedimiento reemplaza la organización de frontends de este documento cuando se publique esa etapa; las precauciones de migración, corte de escritores y recuperación de ventas siguen vigentes. DNS y producción continúan sin cambios.

## Preparación

1. Revisar `implementacion/pos-parte-2` junto con la Parte 1 conservada. Revisar archivos nuevos y cambios locales antes de preparar commits: existen documentos/capturas previos ajenos al POS que no deben incorporarse por accidente.
2. Instalar con `npm ci` en raíz y servidor usando los lockfiles existentes. No actualizar React, Express, Prisma ni dependencias. Ejecutar los tests descritos en [README](README.md), revisión visual, build y diff-check.
3. Respaldar la base y validar una restauración aislada. Registrar conteo/suma de stock, pedidos por estado y las cajas/ventas existentes, si las hubiera. Verificar permisos para `pg_trgm` e índices GIN en el PostgreSQL destino. Definir capacidad de conexiones conforme al entorno Neon/API existente.
4. Confirmar cuentas personales, responsables de supervisión, caja física por turno y métodos reales habilitados. Probar lectora USB configurada como teclado con sufijo Enter, distribución del teclado y papel térmico de 80 mm. Verificar ceros iniciales y lectura de etiquetas.
5. Acordar cómo continuará la emisión fiscal vigente mientras el adaptador está deshabilitado. Definir procedimiento para verificar abonos/reembolsos manuales y conciliar referencias bancarias.

## Ventana de publicación coordinada

1. Detener **todos los escritores** de ambas partes: API vieja, checkout, paneles, POS, seeds, scripts y procesos auxiliares. Ocultar el panel no basta. No mantener versiones viejas y nuevas escribiendo simultáneamente.
2. Tomar respaldo final consistente y guardar su referencia y hora Lima. Detener intentos abiertos del navegador sin borrar sus claves; resolver los inciertos antes del corte cuando sea posible.
3. Con una conexión de migración configurada de forma segura para el entorno destino, ejecutar desde `server` únicamente el procedimiento revisado `npx prisma migrate deploy`. Si Prisma/Neon requieren conexión directa para DDL, utilizarla según la configuración del proyecto, sin exponer la URL.
4. Orden de migraciones preparadas:
   - `20261017000000_inventory_part1`: SKU, códigos, Kardex, corte inicial único y guardas de stock.
   - `20261017010000_pos_part2`: POS, caja, pagos, devoluciones, idempotencia, índices y restricciones de conciliación/inmutabilidad.
5. No ejecutar `migrate dev`, `db push`, `migrate reset`, seed ni fixtures QA en el negocio. No repetir la fotografía inicial del stock ni reconstruir cobros históricos.
6. Generar/instalar el cliente Prisma correspondiente al schema nuevo y desplegar API/frontend juntos antes de reabrir escrituras. El cliente de producción no se obtiene de los directorios temporales de pruebas.
7. Verificar que las migraciones no alteraron cantidades existentes. Debe haber un saldo inicial por producto, costos iniciales NULL y cero ventas/turnos creados por la migración. Verificar autorizaciones, consulta de tienda/inventario y estado fiscal NOT_CONFIGURED sin crear ventas de ensayo en producción.
8. Reabrir operaciones, registrar el corte y supervisar errores 409/5xx, diferencias de caja, cierres y conciliación entre ventas, pagos y Kardex. La primera venta real debe ser una operación auténtica autorizada del negocio, no una fixture.

## Comprobaciones de sólo lectura

Estas consultas sirven para una revisión autorizada después del despliegue o de una restauración; no corrigen datos automáticamente.

```sql
-- Debe devolver cero filas: stock distinto de Kardex.
SELECT p.id, p.stock,
       coalesce(sum(CASE WHEN m.direction='IN' THEN m.quantity ELSE -m.quantity END)
         FILTER (WHERE m.status='CONFIRMED'),0) AS ledger_stock
FROM products p LEFT JOIN inventory_movements m ON m."productId"=p.id
GROUP BY p.id, p.stock
HAVING p.stock <> coalesce(sum(CASE WHEN m.direction='IN' THEN m.quantity ELSE -m.quantity END)
         FILTER (WHERE m.status='CONFIRMED'),0);

-- Debe devolver cero filas: venta confirmada sin el total de pagos confirmado.
SELECT s.id, s.total FROM pos_sales s
WHERE s."confirmedAt" IS NOT NULL AND s.total <>
 (SELECT coalesce(sum(p.amount),0) FROM pos_payments p
  WHERE p."saleId"=s.id AND p.status='CONFIRMED');

-- Debe devolver cero filas: cierre esperado distinto del libro de efectivo.
SELECT s.id FROM cash_sessions s WHERE s.status='CLOSED' AND
 (s."expectedAmount" <> s."openingAmount" +
    (SELECT coalesce(sum(e.amount),0) FROM cash_entries e WHERE e."sessionId"=s.id)
  OR s.difference <> s."countedAmount"-s."expectedAmount");
```

## Respuesta perdida o caída de red

1. Conservar el navegador, cuenta y `requestId` del intento. No cobrar de nuevo ni cambiar de clave.
2. Restablecer conectividad y usar Recuperar mismo intento. La respuesta viene de `pos_operations` si ya se confirmó. No se vuelve a descontar stock ni sumar dinero.
3. Si el servidor confirma rechazo 4xx, corregir datos antes de intentar de nuevo. Si no se puede conocer el resultado o hay 5xx repetidos, detener ese cobro y revisar operación, ventas, pagos, Kardex, caja y referencia de abono real desde supervisión. Conservar evidencia del incidente.
4. No editar la respuesta guardada ni borrar operaciones para desbloquear la UI. Un error de código o restricción se resuelve con una corrección revisada; después se recupera la misma operación. Una aprobación bancaria externa no puede deducirse del estado de la red.

## Error funcional con la base disponible

Si falla una migración, consultar primero `npx prisma migrate status` y comprobar que su transacción realmente se revirtió. Corregir y ensayar en una copia aislada. Sólo después de confirmar el rollback, el operador puede usar el procedimiento Prisma revisado `migrate resolve --rolled-back <migración-fallida>` para permitir un nuevo intento. Nunca marcarla como aplicada si faltan objetos ni borrar filas de `_prisma_migrations` a mano.

Detener escritores si hay riesgo de inconsistencia, respaldar y conciliar antes de continuar. Las ventas/pagos/asientos confirmados se conservan. Registrar devoluciones/anulaciones o movimientos compensatorios autorizados y enlazados, usando una caja nueva si la original está cerrada. No cambiar cantidades, cerrar diferencias ni eliminar historial por SQL.

No volver a la API anterior a estas migraciones: sus escrituras sin Kardex serán rechazadas y podría omitir el libro financiero. Preparar una corrección compatible hacia adelante, volver a probarla sobre una copia aislada y reabrir tras revisión.

## Pérdida de base / restauración

1. Suspender checkout, POS y demás escritores. Conservar referencias de pago, tickets, identificadores de operaciones y el último corte conocido. No recibir nuevos cobros mientras la base no sea verificable.
2. Restaurar el respaldo mediante el procedimiento del entorno en una base aislada y verificar integridad, secuencia de migraciones y consultas anteriores. Conservar la base dañada y sus registros para auditoría.
3. Comparar el corte del respaldo con operaciones posteriores conocidas. Una operación presente en banco/ticket pero ausente del respaldo no autoriza volver a cobrar. Conciliar manualmente con supervisión y registrar su recuperación mediante un procedimiento revisado, preservando referencia original; no ejecutar fixtures ni inventar ventas para igualar cifras.
4. Resolver también pedidos web y movimientos posteriores al corte. Verificar producto por producto, cobros por método, devoluciones y cierres. Restaurar sólo la base sin conciliar pagos externos puede perder operaciones ya cobradas.
5. Generar un nuevo corte consistente, desplegar versiones compatibles y reabrir por etapas. Mantener el incidente, respaldos y trazabilidad. No hay un down automático que borre tablas financieras ni una reapertura de cajas cerradas.

## Integraciones y límites pendientes

Faltan proveedor fiscal real, configuración tributaria/credenciales/series, implementación de adaptador, autenticación de respuestas y homologación; también cualquier integración bancaria automática. Las devoluciones digitales son anotaciones de reembolsos reales verificados manualmente. El POS no garantiza idempotencia de una transferencia hecha fuera del sistema ni valida imágenes de pago. Esas referencias requieren conciliación con la entidad externa.

La lectora e impresora se simularon mediante teclado y navegador; es obligatorio completar la prueba física y de impresión al 100 % antes de operación. No hay ventas offline, anticipos cobrados parciales, crédito, multi-almacén, costeo ni utilidad estimada. El carrito sin guardar se mantiene en memoria; pendientes guardados y operaciones inciertas sí se recuperan según el flujo documentado. Una pestaña cerrada o almacenamiento borrado requiere recuperación desde el historial y conciliación por supervisión.
