# TecRuta — Inventario y POS, partes 1 y 2

> Actualización posterior: la separación local de tienda y Panel TecRuta está documentada en [Panel TecRuta](../panel/README.md). Las rutas de esta entrega anterior `/admin/...` ahora redirigen a `/<sección>` en el panel. POS mantiene `/pos`. Ninguna de las etapas se ha publicado todavía.

Entrega local preparada para revisión en `implementacion/pos-parte-2`. Se conserva todo el trabajo anterior y se creó una copia de los archivos modificados antes de continuar. No se hicieron commits, push, publicación ni migraciones sobre producción. Las versiones y ambos lockfiles se conservan.

## Accesos

| Ruta | Perfil | Función |
| --- | --- | --- |
| `/pos` | ADMIN, CASHIER | Venta presencial o cobro de un pedido web |
| `/pos/caja` | ADMIN, CASHIER | Apertura, movimientos, conteo, cierre e historial |
| `/pos/ventas` | ADMIN, CASHIER | Pendientes, tickets y trazabilidad; devolución/anulación sólo ADMIN |
| `/pos/reportes` | ADMIN, CASHIER | Ventas, pagos, productos, devoluciones, cajas y stock bajo |
| `/admin/inventario` | ADMIN, WAREHOUSE, CASHIER | Parte 1, con ventas y devoluciones POS en Kardex |
| `/admin/clientes` | ADMIN | Asignación de cuentas individuales a almacén/caja |
| `/admin/pedidos` | ADMIN | Estado logístico y enlace al cobro POS |
| `/admin/pagos` | ADMIN | Métodos activos; el POS reutiliza su configuración |

El POS tiene una presentación propia, sin navegación comercial, footer ni carrito público. La tienda sigue en las rutas existentes. El menú de cuenta y el panel enlazan al POS según el rol. Cada persona utiliza su propia cuenta.

## Operación y consistencia

- **Venta presencial:** no crea un pedido web ni una cuenta ficticia. Conserva cliente opcional, productos/SKU/nombres/precios, descuento aprobado, pagos y devoluciones. Consumidor final se representa con datos opcionales vacíos.
- **Pendiente POS:** es un presupuesto de cobro guardado, con planes de pagos `PENDING`. No recibe dinero, no afecta caja y no reserva stock. Al cobrar se vuelven a verificar precio y existencias. No se admite registrar anticipos parciales ya cobrados en esta versión: el cobro se confirma íntegro o queda pendiente.
- **Confirmación:** todos los importes asignados deben sumar exactamente el total; cada método requiere confirmación humana del abono real. Los digitales requieren referencia. El efectivo recibido puede ser mayor que el importe asignado; la diferencia es vuelto. Sólo el importe neto asignado entra a caja.
- **Transacción:** venta confirmada, pagos, movimiento de efectivo y Kardex se guardan juntos. Un fallo revierte todos los efectos. La base también comprueba conciliación al COMMIT y protege registros confirmados contra modificaciones/borrados.
- **Descuentos:** sólo un ADMIN puede concederlos; quedan registrados su ID y motivo. No existe un parámetro para que el cajero se autoasigne aprobación. Se prorratean por líneas en céntimos, sin pérdida del total.
- **Concurrencia:** filas de pedido, venta, caja y productos se bloquean en un orden estable. Dos compradores web/POS no pueden consumir la misma última unidad. Cierre y cobro simultáneos se serializan: el cierre incluye el cobro o éste se rechaza íntegro.
- **Idempotencia:** cada mutación lleva un UUID de operación y hash del cuerpo/usuario/ruta lógica. El mismo intento recupera su respuesta incluso después del cierre; un cuerpo distinto con la misma clave devuelve 409. Las respuestas perdidas no crean otra venta, retiro o devolución.
- **Sin conexión:** se bloquea el cobro; no se usa un catálogo local como autoridad. El navegador conserva en `sessionStorage` el intento pendiente, bajo la cuenta correspondiente. Tras recargar, “Recuperar mismo intento” reenvía la misma operación. No se debe borrar almacenamiento ni abrir un cobro nuevo mientras exista un resultado incierto. Un fallo 4xx confirmado permite corregir el formulario; un fallo de red/5xx mantiene el intento para conciliación.

Los importes de API son **cadenas decimales**, por ejemplo `"19.90"`. Se convierten a céntimos BigInt para cálculos y se persisten en Decimal PostgreSQL. No se hacen cálculos monetarios con punto flotante. Las cantidades son enteras.

## Relación con pedidos web

Un pedido web existente ya reservó stock al crearse. El POS lo carga por referencia y crea **una única venta vinculada** mediante `orderId` único; conserva productos y precios originales del pedido. Cobrarlo no genera otro movimiento de salida ni revalida contra un precio comercial nuevo: el precio contractual se valida contra el pedido guardado.

Sólo se cobran pedidos PENDING/CONFIRMED. Un pedido ya PAID/SHIPPED/DELIVERED no se vuelve a cobrar, incluso si no tiene venta POS histórica. Un pendiente vinculado se abre desde su venta existente; no se copia como una nueva venta de mostrador.

El panel administrativo ya no puede marcar PAID desde una captura: debe registrar el cobro verificado en POS. Un pedido cobrado en POS no puede cancelarse por la ruta antigua, porque duplicaría la reposición y omitiría el reembolso.

Una devolución íntegra de un pedido aún no despachado lo pasa a CANCELLED dentro de la misma transacción, **sin ejecutar la reposición antigua**: los asientos de devolución POS ya la registraron. Para pedidos SHIPPED/DELIVERED se conserva el estado logístico y se enlaza la devolución. Cualquier devolución parcial previa al despacho bloquea SHIPPED del pedido original íntegro; el administrador debe conciliar lo devuelto y preparar una operación correcta para las unidades que realmente se entregarán. La UI de pedidos muestra el vínculo y la alerta.

Los pedidos pendientes antiguos siguen reservando hasta cancelación explícita. No hay expiración automática. Los pagos históricos marcados fuera de POS no se inventan ni se incorporan retroactivamente a cajas o reportes POS.

## Caja, devoluciones y reportes

Cada usuario puede abrir un turno a la vez con saldo físico inicial. Cajero abre/cierra su propio turno. ADMIN registra ingresos/retiros manuales únicamente en su caja abierta, con motivo. No se permite saldo efectivo negativo. Se conservan entradas inmutables, cierre esperado, conteo, diferencia y observación. No hay reapertura: las correcciones se registran en un nuevo turno. Yape, Plin y transferencias se registran por método, separados del efectivo.

Las devoluciones/anulaciones requieren ADMIN, caja propia abierta, motivo y confirmación del reembolso. Se vinculan a la venta y a cada línea original, nunca exceden unidades vendidas y conservan el precio/descuento original. El reembolso mostrado debe coincidir con `expectedAmount` al confirmar. El redondeo acumulado asegura que devolver todas las unidades devuelve exactamente el neto cobrado.

Una unidad vendible vuelve al stock. Una dañada registra entrada de devolución y salida por daño; el stock vendible no aumenta. La anulación requiere todas las unidades restantes y conserva venta, pagos y movimientos. No borra cobros ni modifica una caja original ya cerrada: el reembolso afecta el turno actual del administrador. Las devoluciones digitales se registran tras realizarlas/verificarlas manualmente; el sistema no ejecuta transferencias externas.

Reportes por días de **America/Lima**, usuario, método y producto; exportación CSV con campos entrecomillados y neutralización de fórmulas. Los reportes de ventas/productos muestran devoluciones asociadas a ventas del periodo, aunque se hayan reembolsado después. El reporte de devoluciones filtra por la fecha real del reembolso. El de cajas filtra por apertura y muestra cierre/contado/diferencia. Los de pagos muestran importes brutos efectivamente registrados; los reembolsos se concilian por separado. Para arqueo bancario, consultar pagos y devoluciones del mismo día/método.

Las consultas/exportaciones se limitan a 10 000 registros y piden reducir filtros si se excede, sin truncar silenciosamente. Historiales rápidos: últimas 100 ventas/turnos; movimientos de caja: hasta 1 000 por consulta. Los cajeros sólo obtienen sus ventas, cobros y turnos; ADMIN puede filtrar el conjunto. No se calcula utilidad: los costos históricos no están consolidados ni se implementó costeo FIFO/promedio.

En ventas, el usuario es quien creó el registro; en pagos, quien confirmó el cobro. Filtrar ventas por método selecciona ventas que incluyeron ese método y muestra su total completo; para sumar exclusivamente los importes de Yape/Plin/efectivo, usar el reporte de pagos filtrado por método.

## Impresión e integración fiscal

El ticket usa cuerpo de 72 mm para papel térmico de 80 mm, con fecha Lima, responsable, productos, descuento, importe por método, recibido, vuelto y devoluciones. Identifica **TICKET INTERNO — NO ES BOLETA NI FACTURA ELECTRÓNICA SUNAT**. Se imprime desde el navegador; faltan las pruebas de la impresora/lectora físicas y de sus controladores. No se acciona un cajón ni un puerto USB desde la web.

`server/src/lib/fiscalGateway.js` prepara un contrato de adaptador con `issue` y `lookup`. El adaptador predeterminado está **desactivado**. GET `/api/pos/fiscal` informa faltantes; POST fiscal devuelve 503. No se generan documentos fiscales locales ni estados ficticios SUBMITTED/ACCEPTED. Agregar credenciales a una variable por sí solo no habilita emisión.

Pendientes: elegir un proveedor real compatible PSE/OSE; contratar y documentar su API; RUC/domicilio/ubigeo, series/correlativos, catálogo tributario/IGV, credenciales por entorno, certificado o delegación de firma según el proveedor, sandbox, autenticación de callbacks, almacenamiento/validación de respuestas y CDR, y pruebas reales autorizadas de integración. La implementación futura debe resolver timeouts mediante consulta con la misma clave antes de emitir otra vez, usando outbox duradero y sin llamadas fiscales dentro de la transacción de venta. No se ha elegido ni contratado un proveedor.

El ticket interno no sustituye el procedimiento fiscal aplicable del negocio. Referencias oficiales consultadas: [SUNAT: PSE](https://cpe.sunat.gob.pe/aliados/pse) y [SUNAT: SEE-OSE](https://cpe.sunat.gob.pe/informacion_general/operador_servicios_electronicos). No se presume aceptación fiscal sin una respuesta auténtica del proveedor y su verificación.

## Validación y revisión

Se reutiliza el runtime de QA de la Parte 1: PostgreSQL Docker desechable en loopback, schemas y cliente Prisma temporales, dotenv vacío y datos sintéticos. Se bloquean recursos externos del navegador. No se carga la conexión de negocio, no se envían correos ni documentos, no se llaman billeteras/proveedor fiscal ni se insertan fixtures en el catálogo real.

```powershell
npm run test:inventory
npm run test:pos
npm run qa:inventory-ui
npm run qa:pos-ui
npm run build
git diff --check
```

Para los scripts visuales, las mismas herramientas externas documentadas en [Parte 1](../inventario/README.md): playwright-core 1.64.1, @zxing/library 0.21.3 y pngjs 7.0.0 en un directorio temporal. `TECRUTA_QA_TOOLS` permite indicar su node_modules; `TECRUTA_QA_BROWSER` el ejecutable Chromium/Edge. Puertos Vite: inventario 5178, tienda QA 5188 y POS QA 5199. La revisión interactiva del panel usa 5180 y su tienda 5181. Docker debe estar iniciado; no usar URLs de Neon ni `.env` para preparar QA.

Se validaron 19 casos de POS, 14 de inventario y 67 pruebas existentes de regresión; los casos incluyen stock faltante/precio cambiado, respuesta perdida tras COMMIT, idempotencia, venta web/POS concurrente, cobro web, devolución doble concurrente, daños, falta de efectivo para reembolsar, cierres y coherencia Prisma/migraciones. Los avisos existentes de build sobre ubigeo y tamaño del bundle 3D no cambian el resultado del build.

[Manual por perfil](manual.md) · [Publicación y recuperación](publicacion-recuperacion.md) · [Contrato API](api.md)

## Evidencia

[POS escritorio claro](evidencia/venta-escritorio-claro.png) · [oscuro](evidencia/venta-escritorio-oscuro.png) · [tablet claro](evidencia/venta-tablet-claro.png) · [tablet oscuro](evidencia/venta-tablet-oscuro.png) · [ticket térmico](evidencia/ticket-interno-termico.png) · [recuperación de conexión](evidencia/recuperacion-conexion.png) · [cierre](evidencia/caja-cajero-antes-cierre.png) · [devolución](evidencia/devolucion-administrador.png) · [reportes e integración](evidencia/reportes-y-integracion-fiscal.png) · [Kardex compartido](evidencia/inventario-compartido-kardex.png) · [resultados automáticos](evidencia/resultados.json).

Las capturas contienen exclusivamente datos QA y no forman parte de la base del negocio. El alcance queda listo para revisión local, con integración bancaria/fiscal y hardware físico pendientes; no se habilita operación real desde esta entrega.
