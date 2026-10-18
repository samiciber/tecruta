# Manual breve por perfil

## Administrador

1. Registrar/verificar una cuenta personal por empleado. Asignar Almacén o Vendedor/cajero desde `/admin/clientes`. Mantener cuentas administrativas individuales mediante el procedimiento existente; nunca compartir ADMIN.
2. Revisar categorías, marcas, productos, SKU y códigos en `/admin/inventario`. No cargar stock desde scripts o SQL: entradas, salidas y ajustes deben dejar Kardex. El editor exige motivo y saldo esperado.
3. Activar métodos en `/admin/pagos`. Efectivo usa la clave existente cashOnDelivery; Yape, Plin y transferencia conservan sus claves. En `/pos/reportes` se pueden habilitar/deshabilitar pagos combinados. No habilitar un método que el negocio no pueda verificar.
4. Abrir caja propia en `/pos/caja` para vender, retirar/ingresar efectivo o reembolsar. Registrar motivo y comprobar el dinero físico. Las operaciones no cambian la caja de otro empleado.
5. Aprobar descuentos al crear la venta desde la cuenta ADMIN, indicando motivo. En `/pos/ventas`, seleccionar la venta para devolver/anular: elegir unidades y condición vendible, revisar el importe calculado y realizar/verificar el reembolso. Registrar método, referencia y motivo. Para anulación, seleccionar todas las unidades restantes.
6. Revisar cierres, diferencias, pagos digitales y devoluciones mediante reportes/CSV. No cambiar una caja cerrada: abrir un turno nuevo y dejar un movimiento compensatorio con referencia al incidente.
7. Para pedidos web, usar el enlace de `/admin/pedidos` al POS; el stock ya estaba reservado. No volver a registrar los mismos productos como venta presencial. Reembolsos y cancelaciones de cobros POS se realizan desde su venta vinculada.

## Almacén

1. Acceder a `/admin/inventario`. El perfil WAREHOUSE no tiene POS ni acceso a cajas/pagos.
2. Identificar por lector con Enter o búsqueda manual. Guardar códigos como texto; conservar ceros. SKU y alias no se reutilizan entre productos. Los alias internos empiezan por TR-.
3. Registrar compras, devoluciones, pérdidas, daños y ajustes con referencia/motivo; incluir proveedor/costo real si se conoce. Guardar borrador y confirmar sólo después de revisar la mercadería. Un escaneo por sí solo no registra el movimiento.
4. Revisar Kardex antes de devolver mercancía de una venta: las devoluciones POS ya generan sus propios asientos. No repetirlas como entrada manual. Un dañado devuelto por POS no debe contarse como vendible.
5. Imprimir etiquetas y exportar Kardex cuando corresponda. Los movimientos confirmados se corrigen mediante reversión enlazada; los asientos de ventas POS se corrigen desde la venta por un administrador.

## Cajero

1. Iniciar sesión con la cuenta personal y entrar a `/pos`. Abrir `/pos/caja`, contar efectivo inicial y abrir turno. No usar la cuenta de otra persona.
2. En Venta, enfocar el lector y escanear. Cada repetición suma una unidad. También se puede buscar nombre/SKU/código, cambiar cantidades o retirar líneas. El stock visible es informativo hasta la confirmación del servidor.
3. Dejar cliente vacío para consumidor final o escribir sus datos reales si se identifica. No crear cuentas ficticias. Para un pedido web, cargar su referencia y cobrar ese registro: no crear otra venta por las mismas unidades.
4. Elegir uno o varios métodos activos. Asignar el importe neto por método. En efectivo, escribir lo recibido y revisar el vuelto. En digital, verificar el abono directamente en la cuenta del negocio y registrar referencia; una imagen enviada por el cliente no verifica el dinero.
5. Marcar la verificación de cada pago, revisar el total y confirmar venta/cobro. Imprimir el ticket interno. El ticket no es una boleta/factura electrónica; seguir además el procedimiento fiscal del negocio.
6. Si no se cobra, Guardar pago pendiente: guarda el registro, no recibe dinero ni reserva stock. Recuperarlo desde Ventas. Si cambió precio o falta stock al cobrar, cancelar el pendiente y crear la venta revisada; no cobrar con datos antiguos.
7. Ante error de conexión, no repetir el pago al cliente ni crear una venta nueva. Usar **Recuperar mismo intento**, incluso después de recargar. Si persiste el error, conservar la pestaña y avisar al administrador para conciliar. No borrar almacenamiento ni cambiar de cuenta mientras exista un intento incierto.
8. Para devolver/anular o conceder descuentos, solicitar a ADMIN; no compartir credenciales. Al terminar, contar efectivo, registrar observación y cerrar el turno. La diferencia queda registrada; el turno no se reabre. Los abonos digitales no se suman al efectivo contado.
