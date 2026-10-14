# Lote 7: catálogo y pagos vigentes, compras seguras sin API

## Resumen

- H18 resuelto para compras: el respaldo permite consultar, pero no agregar al carrito ni crear un pedido con IDs estáticos/no verificados.
- H20 resuelto en productos y pagos: caché compartida, TTL activo de 60 s, foco/visibilidad, reintento e invalidación tras cambios relacionados.
- Los pagos sin verificar no muestran cuentas/QR estáticos; los cambios en un método seleccionado exigen elegirlo de nuevo y una lista vacía permanece vacía.
- Carritos con productos ausentes/menos stock se conservan y requieren revisión explícita; detalle distingue ausencia confirmada de API no disponible y captura fallos de import.
- Sin despliegue, migraciones ni llamadas/escrituras a producción. QA usa fixtures; los pedidos de la prueba de recuperación son respuestas simuladas.

## Archivos

| Ruta | Cambio |
|---|---|
| `src/services/liveResource.js` | Store compartido independiente de React: deduplicación, TTL, eventos, backoff, timeout/abort y generaciones. |
| `src/services/purchaseResources.js` | Recursos de productos/pagos, contratos verificados y GET con cache:no-store; solo catálogo tiene fallback. |
| `src/hooks/useProductIndex.js`, `src/hooks/usePaymentMethods.js` | Suscripción con useSyncExternalStore, origen/error/frescura explícitos y actualización manual. |
| `src/utils/purchasePolicy.js` | Validación de respuestas, normalización/agrupación de IDs de carrito y revisión de cantidades. |
| `src/services/api.js` | Signal/cache opcionales y, después de éxito, invalidación de recursos relacionados. |
| `src/context/CartContext.jsx` | Solo agrega referencias confirmadas, bloquea compra parcial y difiere la fusión de IDs/cantidades incompatibles; conserva el carrito. |
| `src/components/ui/CatalogAvailability.jsx`, `src/App.jsx` | Aviso público de degradación, reintento y revisión explícita del carrito; el aviso global no invade admin. |
| `src/components/product/ProductCard.jsx`, `src/components/cart/CartParts.jsx`, `src/components/cart/CartUpsell.jsx` | Controles de agregar deshabilitados sin información verificable. |
| `src/services/catalogDetail.js`, `src/pages/ProductDetail.jsx` | Usa el DTO completo del índice API; fallback solo informativo, import controlado y protección ante cambio de slug. |
| `src/pages/Cart.jsx` | Aviso/revisión y acceso a pagar bloqueado; restricciones de ancho iguales a las preparadas en Lote 1. |
| `src/pages/Checkout.jsx`, `src/components/checkout/WhatsAppButton.jsx` | Verifica fuente/edad/IDs/pago antes del POST; no navega por WhatsApp si el guard rechaza. |
| `src/pages/Help.jsx` | Pagos no verificados/ausentes tienen estado claro y reintento, sin destinos estáticos. |
| `tests/lote-7.test.mjs` | Diez pruebas de fronteras y funcionamiento de la caché/política. |
| `src/hooks/useCachedResource.js`, `README.md` | Corrige comentarios/documentación de alcance y la promesa de actualización automática. No cambia el algoritmo de contenido. |
| `docs/lotes/lote-7-integracion-con-lote-3.patch`, `docs/lotes/lote-7.md` | Resolución concreta sobre Lote 3 y esta guía. |

## Política y funcionamiento

Cada recurso mantiene un snapshot API o de respaldo, fecha de comprobación, estado de carga/error y generación. Solo un snapshot API exitoso, válido y con edad menor a 60 s se considera vigente. Un error conserva los últimos datos API para consulta, pero pausa las compras; nunca convierte ese dato anterior en una confirmación nueva. Una respuesta vacía exitosa reemplaza los datos anteriores, sin restaurar pagos estáticos.

Hay un temporizador compartido por recurso activo en una pestaña visible. Caducidad, foco/visibilitychange, botón de reintento e invalidaciones disparan comprobaciones reales. Los GET de catálogo/pagos usan no-store para evitar renovar artificialmente la vigencia con la caché HTTP del navegador. Se comparte una sola petición entre los consumidores; errores reintentan a los 15 s, sin bucle de renders. Peticiones y carga del fallback tienen límite de 10 s, con abort para fetch. Ocultar la pestaña evita sondeo de API; al volver se comprueba de nuevo. No es un SLA: red, suspensión del navegador y temporizadores pueden retrasar la recuperación.

Una invalidación incrementa la generación, marca el snapshot vencido y actualiza a los consumidores montados. Si llega una respuesta anterior, se descarta y se hace una única nueva petición. Solo mutaciones HTTP exitosas invalidan: productos/asignación, marcas, categorías/árbol, estados de pedido que pueden restaurar stock, creación de pedido y métodos de pago. No se invalidan recursos por un login ni por errores de guardado.

Los componentes y CartContext bloquean agregar cuando el origen no sea API vigente o el ID/precio no coincida con ese snapshot. Stock/cantidades se resuelven desde la misma fuente. IDs duplicados del carrito se agrupan antes de revisar stock. IDs ausentes, stock cero o cantidad solicitada mayor al disponible bloquean el checkout; no se manda un pedido con solo los artículos que se pudieron mostrar. El carrito persiste hasta una acción explícita: aceptar la cantidad disponible o quitar los artículos que requieren revisión.

Al restaurar sesión, la fusión del carrito espera una API válida y la revisión de IDs/cantidades. No se envían IDs estáticos incompatibles ni se borra su selección silenciosamente. Se bloquea agregar/pagar mientras carga la fusión. Se conserva el guard de identidad en la respuesta inicial para que una sesión anterior no restaure su carrito tras cambiar de usuario. Este lote no rediseña guardados ni toda la sincronización optimista del carrito.

Pago seleccionado: se conserva temporalmente durante una caída, pero no se muestran sus destinos ni se puede comprar. Tras una respuesta API válida, si el método desapareció o cambiaron su cuenta/instrucciones/configuración, se borra la selección y se pide elegir de nuevo. El callback comprueba también la frescura real al hacer clic: un botón renderizado antes de caducar no autoriza un pedido después de la caducidad. No se usan datos estáticos de transferencias, QR o métodos activos como fallback.

El endpoint público de índice devuelve el mismo DTO completo que el detalle; por ello la ficha usa ese snapshot API y no mezcla su ID/precio con un import estático. Si solo hay respaldo, carga su ficha local con catch final y no permite comprar. Un slug ausente en un catálogo API válido muestra Producto no encontrado; sin API verificable no se afirma que el producto fue eliminado. Respuestas tardías al cambiar de slug no sustituyen la ficha actual.

**El servidor continúa siendo la autoridad** para stock, precio, estado del pedido y autorización; la edad de la caché solo evita una experiencia engañosa. Para desplegar, integrar la confirmación/idempotencia del Lote 3; este PR parte de main, que aún conserva el checkout anterior.

## Cómo probar y resultados

1. Instalar los lockfiles con `npm ci` y ejecutar `npm run build`: sin errores, sobre React 18/Vite 5 de main. Persisten las advertencias conocidas de ubigeo y bundle 3D. Sin dependencias nuevas ni cambios de esquema/backend.
2. `node --test tests/lote-7.test.mjs`: 10/10. Casos: invalidaciones por ruta, deduplicación de 30 consumidores, fallback bloqueado, import fallido, recuperación, conservación del último API, lista vacía, TTL/backoff sin navegación, respuesta vieja tras invalidación, timeout/abort, validación de contratos y revisión de IDs/cantidades duplicadas y elegidas antes de un cambio de stock. Usa relojes simulados, sin red ni BD.
3. Chromium sobre Vite con API/medios interceptados: 48 mediciones (catálogo offline, ficha offline, carrito no resuelto y checkout con pagos sin verificar × 390/768/1024/1280/1440/1920 × claro/oscuro). Avisos dentro del viewport y estados/controles correctos. Usa las restricciones minmax/min-w-0 de Cart ya preparadas en Lote 1, para que el nuevo aviso no herede el desbordamiento de main. No es una nueva auditoría de toda la Home.
4. En el mismo documento: API vuelve y Reintentar catálogo habilita los productos; tras adelantar 60 s cambian precio/stock sin navegar; focus actualiza aun sin caducidad. PATCH admin simulado invalida catálogo/pagos. Un fallo conserva el precio mostrado y bloquea agregar. Método cambiado exige elegir de nuevo; active:false/[] no revive los pagos estáticos. Un módulo de ficha ausente termina con error recuperable; un slug inexistente se muestra explícitamente. Cero peticiones de pedido en esta matriz.
5. Restauración autenticada simulada: carrito con ID estático desconocido y cantidad superior al stock no dispara merge. Aceptar cantidad disponible y quitar el ID desconocido permite una sola fusión con referencias vigentes; almacenamiento invitado se limpia solo después del resultado. Se probaron cantidades e IDs, no cuentas reales. En la ficha, una cantidad elegida antes de reducir stock queda bloqueada hasta ajustarla explícitamente; la prueba adicional pasó.
6. Copia temporal combinada de frontend con Lotes 1/3/4: build, la misma matriz de 48 mediciones y recuperación/TTL/foco/invalidación/pagos pasan. Retiene las restricciones de ancho y contraste del Lote 1, confirmación del Lote 3 y auth/código de intercambio del Lote 4. No se integraron ramas/PRs ni se ejecutó backend/BD en esa copia.
7. Prueba adicional sobre ese frontend: respuesta de pedido simulada perdida, catálogo temporalmente caído y reintento del mismo payload/key. El carrito permanece hasta la confirmación, después se vacía y aparece el enlace basado en la respuesta del servidor. Dos peticiones de pedido interceptadas y respondidas por fixtures; no se crea registro ni se abre WhatsApp.

Evidencia en `/workspace/audit-tecruta/lote-7/`: unit.log, build.log, browser.log/browser.json, cart-review.log/cart-review.json, combined-build.log, combined-ui.log/combined-ui/browser.json, attempt.log/attempt.json, quantity.log/quantity.json y capturas de avisos/pagos. Ninguna solicitud de QA llega a producción; no hay IDs de registros de producción creados por este lote.

## Integración con PR anteriores

Main sigue en 8470fc1; los PR anteriores siguen abiertos. Conflictos anticipados con Lote 3: Checkout.jsx, WhatsAppButton.jsx y api.js. El parche es un diff sin contexto (`git apply --unidiff-zero`) sobre su versión exacta de Checkout/api y sirve como resolución revisable. **Conservar WhatsAppButton del Lote 3**, que registra/espera el pedido, y añadir los guards de este lote a handleConfirm; no reintroducir el enlace paralelo de main.

Conservar en api.js los headers de idempotencia/recibo, code/productId y los endpoints GoogleExchange/logoutAll del Lote 4 al añadir signal/cache e invalidación. El parche parte del Lote 3, por lo que las dos entradas nuevas de auth deben mantenerse aparte si ya está integrado el Lote 4. ProductDetail se solapa con Lote 1: usar la versión de este lote, que mantiene los estados explícitos y la protección frente a slug/respuesta tardía, con el DTO de índice completo.

En el checkout combinado, los datos vigentes y la revisión se exigen para **un intento nuevo**. Un intento ya persistido mantiene su payload/key/principal y puede recuperar su resultado del backend aunque cambie el catálogo/pago; no se reconstruye desde el respaldo ni se cambian sus datos. Los controles de edición siguen deshabilitados. Esto conserva la recuperación/idempotencia del Lote 3 y evita crear otro pedido tras perder la respuesta. Se probó esta excepción con el mock anterior; el backend del Lote 3 valida el intento y resuelve su existencia de forma atómica.

No se tocan archivos reservados: Home, components/home, Footer, content.routes, adminContent.routes o navSchemas. La prueba combinada es una copia de frontend fuera del checkout; no es una integración ni despliegue de toda la pila.

## Riesgos, límites y reversión

Ante fallos de API, el sitio deja consultar, pero evita compras nuevas. Productos antiguos con IDs incompatibles necesitan revisión; no se migran por coincidencia de slug/nombre. Los pagos inaccesibles no muestran instrucciones anteriores para prevenir transferencias a datos no comprobados. La carga inicial puede tardar hasta timeout antes del respaldo y se reintenta mientras la pestaña visible tenga consumidores.

H20 de este lote cubre productos/pagos. La caché genérica de contenido sigue comprobando TTL en montaje/visibilidad/invalidation, sin temporizador; el legado de categorías conserva su propio comportamiento. Se corrigió la promesa global de actualización automática en README. Guardados y todas las carreras de sincronización del carrito quedan fuera del rediseño; ninguna de sus tarjetas puede comprar sobre fallback porque pasa por CartContext.

No se probaron producción, proveedores reales, checkout real, integración final de todas las migraciones/PRs ni suspensión específica de cada navegador. Las pruebas usan Chromium y clocks/fixtures; no constituyen certificación de todos los decodificadores ni del contraste completo. El guard del frontend no sustituye al Lote 3 ni a las validaciones del servidor.

Para revertir: commit de reversión del PR y redeploy del frontend anterior. Sin migraciones, datos ni variables que revertir. Persistencia de carrito/sessionStorage conserva su formato; no se limpia automáticamente al revertir. Antes de desplegar, revisar y probar la resolución de los PR anteriores.

Lote 7 listo. Escribe continuar para el Lote 8.
