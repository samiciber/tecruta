# Contrato de API POS

Base `/api/pos`, Bearer de la autenticación existente. Sólo ADMIN/CASHIER; autorización fresca en la base para cada petición. Respuestas privadas sin caché. Errores de permisos no deben degradarse a modo invitado.

| Método / ruta | Función |
| --- | --- |
| GET `/config` | Métodos activos y allowMixed; sin datos bancarios/credenciales |
| PUT `/config` | ADMIN configura allowMixed booleano |
| GET `/products?q=...` | Búsqueda con mínimo 2 caracteres, máximo 20 DTO; índices GIN/trigramas |
| GET `/cash` | Turnos recientes (cajero propios, ADMIN todos) y saldo esperado |
| POST `/cash` | Apertura: requestId, openingAmount |
| GET `/cash/:id/entries` | Libro inmutable de efectivo del turno |
| POST `/cash/:id/entries` | ADMIN: requestId, direction IN/OUT, amount, reason |
| POST `/cash/:id/close` | requestId, countedAmount, reason; caja propia |
| GET `/web-orders/:id` | Pedido exacto con estado, total, líneas y venta vinculada |
| GET `/sales` / GET `/sales/:id` | Historial/detalle con líneas, pagos, devolución y aprobación |
| POST `/sales` | Crear pendiente o confirmar venta completa |
| POST `/sales/:id/confirm` | Cobrar pendiente con plan definitivo verificado |
| POST `/sales/:id/cancel` | Cancelar sólo pendiente, con requestId y reason |
| POST `/sales/:id/refunds` | ADMIN: devolución/anulación enlazada |
| GET `/reports` / `/reports/export.csv` | type, from/to (YYYY-MM-DD Lima), userId, method, productId |
| GET `/fiscal` | Estado desactivado y configuración pendiente |
| POST `/sales/:id/fiscal` | ADMIN; 503 mientras no exista integración real |

Todas las mutaciones operativas llevan `requestId` UUID. Se debe conservar con el mismo cuerpo y usuario ante timeout/red/5xx; el servidor guarda respuesta y efectos en una misma transacción. Reutilizar una clave para otro cuerpo/usuario/ruta devuelve 409. No se debe cambiar automáticamente la clave después de un fallo incierto.

Ejemplo **sintético** de venta combinada; no ejecutar sobre una base real:

```json
{
  "requestId": "f0e0d0c0-b0a0-4000-8000-000000000001",
  "sessionId": "id-del-turno-propio-abierto",
  "mode": "CONFIRM",
  "items": [{ "productId": "id-de-producto", "quantity": 1, "expectedPrice": "19.90" }],
  "discount": "0.00",
  "payments": [
    { "method": "cashOnDelivery", "amount": "10.00", "received": "20.00", "verified": true },
    { "method": "yape", "amount": "9.90", "reference": "QA-REFERENCIA-NO-REAL", "verified": true }
  ]
}
```

`mode=PENDING` no registra cobro y admite pagos vacíos o planes todavía sin verificar. `CONFIRM` exige la suma exacta de pagos verificados y precios/stock vigentes. Para cobrar un pendiente, enviar requestId, sessionId y payments a su ruta confirm. Las líneas guardadas no se reescriben.

Para cobrar web: enviar `orderId`, items vacío y discount cero. El servidor toma precio, cantidades y cliente del pedido guardado; rechaza repetidos por restricción única. No pasar de nuevo las líneas como venta POS.

Devolución: requestId, sessionId propio, kind RETURN/VOID, reason, method, reference digital cuando corresponda, verified true, expectedAmount decimal, items `[ { saleItemId, quantity, restock } ]`. El monto se calcula con el neto original y el redondeo acumulado. `expectedAmount` es la revisión previa y debe coincidir. VOID exige todas las unidades restantes. El cajero no puede ejecutar esta ruta ni conceder descuentos.

Campos monetarios son cadenas con hasta dos decimales; números JSON, negativos en entradas monetarias o decimales adicionales se rechazan. Campos extra no se admiten. Todas las sumas del servidor usan céntimos enteros y la persistencia Decimal, incluyendo vuelto, neto de descuentos y reembolsos.

Los métodos compatibles son `cashOnDelivery` (efectivo POS), `yape`, `plin`, `bankTransfer`; se verifica PaymentMethod.active y config.posEnabled distinto de false. No se permite repetir un método en el mismo plan: sumar sus importes en una línea. Permitir mezcla se guarda en SiteSetting.posConfig.allowMixed.

Reportes: types sales, payments, products, refunds, cash, low-stock. Las fechas de filas se presentan en Lima con -05:00; los timestamps de persistencia y respuestas generales conservan UTC/ISO. Los importes de reportes no incluyen costos inventados. Los reportes y exportaciones excesivos devuelven 422 solicitando filtros más estrechos.
