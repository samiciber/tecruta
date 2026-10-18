# Inventario profesional — Parte 1

La [Parte 2: POS y caja](../pos/README.md) complementa esta entrega: el cajero tiene ahora acceso a `/pos`, y los cobros/devoluciones de pedidos web siguen el procedimiento integrado allí documentado. Esta página conserva el alcance original de inventario.

Implementación local, pendiente de revisión y publicación. No se aplicaron migraciones ni pruebas al negocio. No se modificaron dominios, DNS, alojamiento, credenciales ni versiones de dependencias.

## Estado y rutas

Se consultó `origin/main` el 17/10/2026; el checkout estaba actualizado en `97684b3`. Se conservó el trabajo local y se continuó en `implementacion/inventario-parte-1-continuacion`. Los documentos y capturas anteriores de `docs/lotes` se conservaron. La entrega queda en el árbol de trabajo, sin push ni despliegue.

| Ruta | Uso |
| --- | --- |
| `/admin/inventario` | Existencias, lector, códigos, etiquetas, borradores y Kardex |
| `/admin/productos` | Alta/edición; cambios de stock con motivo y saldo esperado |
| `/admin/pedidos` | Estados de pedidos y cancelaciones |
| `/admin/clientes` | Asignación de roles a cuentas individuales |
| `/api/admin/inventory/*` | API de inventario, autenticada y autorizada por rol |

## Permisos y cuentas

| Operación | ADMIN | WAREHOUSE (almacén) | CASHIER (vendedor/cajero) | CUSTOMER |
| --- | --- | --- | --- | --- |
| Consultar stock, buscar y escanear | Sí | Sí | Sí | No |
| Kardex, filtros y CSV | Sí | Sí | Sí | No |
| Registrar/quitar códigos, imprimir etiquetas | Sí | Sí | No | No |
| Crear/confirmar borradores y revertir movimientos manuales | Sí | Sí | No | No |
| Eliminar borrador | Cualquiera | Propio | No | No |
| Catálogo, pedidos y administración de cuentas | Sí | No | No | No |

El perfil cajero es de consulta en esta parte; no incluye todavía un POS ni ventas de mostrador. No puede promover su cuenta ni escribir stock. La API vuelve a leer el rol de la base en cada petición; modificar un JWT o conservar uno anterior no amplía permisos. La interfaz redirige los perfiles operativos a inventario y oculta el resto del panel.

Cada persona se registra y verifica con su correo, usando la autenticación existente. Un administrador asigna `WAREHOUSE` o `CASHIER` desde Clientes. Para una nueva cuenta administrativa individual se conserva el procedimiento `server/prisma/make-admin.js`; no se comparte la cuenta ADMIN ni se otorga ADMIN desde la API de roles. La API impide cambiar el rol propio o modificar cuentas ADMIN por este mecanismo. Para retirar acceso operativo, devolver la cuenta a CUSTOMER; los movimientos conservan su autoría.

## Identificación y etiquetas

Todo producto recibe un SKU obligatorio y único. La migración asigna `TR-` + MD5 del ID existente; las altas del editor generan `TR-` + ID en mayúsculas. No se alteran slugs, precios, categorías ni marcas. Un trigger también asigna SKU a importaciones antiguas que lo omitan.

Los códigos del fabricante son texto, de 1 a 128 caracteres, sin controles. Se conservan ceros iniciales; nunca se convierten a número. La comparación normaliza espacios de extremos y mayúsculas para evitar ambigüedad. El namespace de SKU y alias es compartido: un código ocupado no se puede reutilizar, ni siquiera como SKU. Se protege mediante bloqueos y comprobaciones de API y base de datos.

Los alias internos usan `TR-` seguido de letras, números, puntos, guiones o guiones bajos (máximo 39 caracteres). El SKU generado ya funciona con el lector y puede imprimirse sin registrar otro alias. No se inventan EAN comerciales.

Seleccionar productos y pulsar **Imprimir etiquetas** abre un documento con nombre, código y precio opcional. Se utiliza Code 128 B, checksum módulo 103 y zonas mudas. El módulo mide 0,254 mm; imprimir al 100 %, sin ajustar a página, y probar una etiqueta con la impresora/lectora reales. La hoja tiene una columna para no comprimir SKU largos. Para payloads 2D no ASCII o códigos de más de 40 caracteres se imprime el SKU interno: el payload original sigue disponible para identificación. La prueba visual decodifica una etiqueta rasterizada a resolución de impresión con ZXing. La impresora y la lectora USB físicas no se probaron en esta sesión.

## Operación y lector

1. Trabajar en el **almacén principal**, único por ahora.
2. Enfocar el campo dedicado y escanear; Enter identifica el producto. También se puede buscar por nombre, SKU o código y seleccionar la fila.
3. En compra, escaneos repetidos del mismo producto acumulan la cantidad del formulario; los demás tipos mantienen una unidad y permiten editarla. Las búsquedas de escaneos se procesan en orden. Un código desconocido informa el error y permite búsqueda manual.
4. Completar tipo, cantidad entera positiva, motivo, referencia y fecha. Compras admiten proveedor y costo unitario real opcionales. Costo vacío significa desconocido; cero es un costo conocido de cero.
5. **Guardar borrador** persiste sin tocar existencias. **Confirmar** exige una acción explícita y confirmación visual separada. Escanear nunca guarda ni confirma movimientos. No hay listener global del teclado ni cambio de foco después de recibir una búsqueda.

Entradas manuales: compra, devolución de cliente y ajuste positivo. Salidas: pérdida, daño, devolución a proveedor y ajuste negativo. Las devoluciones de cliente no cancelan automáticamente un pedido: registrar sólo mercancía físicamente devuelta que no se haya repuesto ya por cancelación.

Cada intento de crear borrador lleva `requestId` UUID. Reintentar con la misma clave/cuerpo/usuario devuelve el mismo borrador; reutilizarla para otra operación devuelve 409. Confirmar dos veces devuelve el movimiento existente sin repetir stock. Tras una respuesta incierta, revisar los borradores antes de iniciar otro intento nuevo.

## Stock, Kardex y pedidos

`server/src/lib/inventoryService.js` centraliza los cambios de stock dentro de transacciones Prisma. Se bloquea la fila del producto antes de leer/modificar; el saldo nunca puede ser negativo. Las claves de origen y la relación de reversión son únicas. Los pedidos bloquean productos en un orden estable para evitar vender la misma última unidad en operaciones concurrentes.

El editor de productos registra la diferencia mediante un ajuste con motivo; debe enviar `expectedStock` cuando cambia la cantidad. Si el stock difiere del saldo que vio el editor, responde 409. Cambiar sólo precio o descripción no envía un nuevo stock desde el formulario. El seed conserva las existencias de productos ya importados y registra saldo inicial únicamente para productos nuevos; sigue sobrescribiendo otros campos del catálogo, por lo que **no debe ejecutarse para publicar esta parte**.

Una restricción diferida comprueba al COMMIT que stock = entradas confirmadas − salidas confirmadas. Una escritura SQL/script que cambie stock sin asiento se rechaza. Los triggers también impiden actualizar o borrar movimientos confirmados. Borradores no intervienen en el saldo.

El flujo anterior **ya descontaba stock al crear un pedido PENDING**, antes de cobrarlo. Se mantiene esa política:

| Evento | Existencias y asiento |
| --- | --- |
| Crear pedido PENDING | Descuento/reserva una vez y movimiento WEB_ORDER en la misma transacción |
| Reintentar checkout con igual Idempotency-Key, cuerpo y cuenta | Mismo pedido, sin otro descuento |
| Confirmar/pagar/enviar/entregar | Sin otro descuento |
| Cancelar PENDING, CONFIRMED o PAID | Repone una vez y registra WEB_CANCELLATION junto al nuevo estado |
| Reintentar o cancelar simultáneamente | Sin otra reposición |
| Pedido SHIPPED o DELIVERED | Conserva las transiciones existentes; no se permite cancelación directa |

No hay expiración automática de pendientes en esta parte: reservan hasta cancelación explícita. La cancelación de pedidos pagados no ejecuta reembolsos externos; el proceso financiero sigue siendo manual. Los movimientos web se corrigen desde Pedidos, no con el botón de reversión del Kardex.

La migración toma **una sola fotografía del stock disponible actual por producto**, incluso cero, sin actualizar cantidades ni inventar costos, usuarios o fechas históricas. No reconstruye ventas anteriores. Un pendiente antiguo ya estaba descontado del saldo disponible: su futura cancelación añade únicamente la reposición, y no crea otro descuento retroactivo. Esto se prueba con un pedido heredado sintético.

El Kardex filtra producto, fecha, tipo y usuario (creador o confirmante). Incluye autor, confirmante, entradas/salidas, saldo y referencia al movimiento revertido. El saldo almacenado es el existente **al confirmar**, aunque se registre una fecha documental anterior; no se recalculan balances históricos al retrofechar. Los filtros de días usan America/Lima (UTC−05:00). Se muestran hasta 50 filas por página; CSV admite hasta 50 000 movimientos y exige reducir filtros si se excede, sin truncar silenciosamente. CSV neutraliza prefijos de fórmulas y entrecomilla campos.

Las correcciones manuales generan un movimiento REVERSAL opuesto, con motivo y vínculo al original. No se modifica el original, no se revierte dos veces ni se permite una reversión que deje stock negativo. Saldo inicial y reversiones no se pueden revertir. Se mantiene el producto y su historia; eliminar un producto con movimientos está restringido.

## Validación reproducible local

Requisitos: Node compatible con el repo, dependencias de ambos lockfiles instaladas y Docker Desktop local iniciado. Las suites fuerzan un contexto Docker local y publican PostgreSQL sólo en loopback con puerto aleatorio. Copian schema/migraciones a un directorio temporal sin `.env`, generan allí un cliente y usan exclusivamente usuarios/bases QA sintéticos. No leen la URL de Neon. Los contenedores se eliminan al terminar; Windows puede retirar la DLL temporal al finalizar el proceso.

Desde la raíz:

```powershell
npm run test:inventory
node --test tests/lote-1.test.js tests/lote-3.test.js tests/lote-4.test.js tests/lote-7.test.mjs server/tests/lote-5.test.mjs server/tests/lote-6.test.mjs server/tests/lote-9.test.mjs server/tests/home-layout.test.mjs server/tests/home-final.test.mjs server/tests/home-sections.test.mjs
npm run build
git diff --check
```

Para la revisión visual, instalar herramientas fuera del repositorio (no cambia dependencias ni lockfiles del negocio):

```powershell
$qaToolsPath = Join-Path $env:TEMP 'tecruta-home-final-tools'
npm install --prefix $qaToolsPath --no-save --package-lock=false playwright-core@1.64.1 @zxing/library@0.21.3 pngjs@7.0.0
npm run qa:inventory-ui
```

La revisión usa Edge local headless y Vite en 127.0.0.1:5178, bloquea todas las peticiones de navegador externas y monta la API real sobre PostgreSQL desechable. Se pueden indicar `TECRUTA_QA_TOOLS` (directorio node_modules) y `TECRUTA_QA_BROWSER` (ejecutable de navegador). No iniciar el servidor de negocio ni ejecutar un seed para estas pruebas.

Resultados: 14 pruebas de integración de inventario y migración; 67 pruebas existentes de regresión; revisión visual con escáner simulado como teclado, persistencia tras recargar, roles, etiquetas decodificadas y tienda pública. El build conserva avisos existentes sobre ubigeo y tamaño del bundle 3D. Las pruebas antiguas de integración que escriben stock directamente requieren fixtures con asientos y `expectedStock`; esta entrega utiliza la nueva suite para esos casos.

Capturas: [escritorio claro](evidencia/desktop-light.png), [escritorio oscuro](evidencia/desktop-dark.png), [tablet claro](evidencia/tablet-light.png), [tablet oscuro](evidencia/tablet-dark.png), [almacén](evidencia/warehouse-tablet.png), [cajero](evidencia/cashier-tablet.png), [etiqueta](evidencia/etiqueta-code128.png), [tienda pública](evidencia/tienda-publica.png). [Resultados de interfaz](evidencia/resultados.json).

## Procedimiento de publicación futura — NO ejecutado

1. Revisar los cambios de esta rama preservando el trabajo local anterior. Preparar artefactos con `npm ci` en raíz y servidor, generar Prisma con su versión fijada, y ejecutar las validaciones anteriores. No actualizar dependencias.
2. Respaldar PostgreSQL/Neon y verificar restauración; registrar conteo de productos, suma y mínimo de stock y pedidos pendientes. Si hay stock negativo, resolverlo explícitamente antes de publicar: la migración falla en lugar de inventar ajustes.
3. Programar una ventana y detener **todos los escritores**, incluido checkout, API antigua, seeds, scripts y tareas. No basta con ocultar el panel. No desplegar versiones vieja y nueva escribiendo a la vez. La migración toma un bloqueo exclusivo de productos para registrar un corte consistente.
4. Con la conexión de migraciones de Neon configurada de forma segura (directa si corresponde al entorno), aplicar `npx prisma migrate deploy` desde `server` y generar el cliente correspondiente. No usar `migrate dev`, `db push`, `migrate reset` ni seed en el negocio. Migración preparada: `20261017000000_inventory_part1/migration.sql`.
5. Verificar en modo lectura que el conteo de INITIAL_BALANCE coincide con productos existentes, sus cantidades/saldos coinciden con la fotografía y todos los costos iniciales son NULL. Comparar el stock total con el respaldo; debe permanecer igual. Revisar que hay SKU únicos y un solo saldo inicial por producto.
6. Iniciar la API nueva y servir el frontend nuevo antes de reabrir escrituras. Validar acceso con cuentas personales, consulta de stock/Kardex y tienda pública sin incorporar fixtures QA. Probar impresión física con una etiqueta autorizada del negocio. No mover dominio, DNS ni hosting.
7. Vigilar errores 409 de concurrencia, 5xx, pedidos pendientes y correspondencia del stock con Kardex. Conservar respaldos y el corte registrado.

Si algo falla antes del COMMIT, la migración se revierte y se debe revisar el estado de Prisma antes de reintentar. Si falla tras habilitar escrituras, detenerlas y aplicar una corrección hacia adelante; **no volver a la API antigua**, porque sus escrituras sin Kardex serán rechazadas. Una restauración de respaldo debe coordinar también pedidos y pagos posteriores; no hay un down automático destructivo.
