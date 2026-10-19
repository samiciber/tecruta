# Operación rápida: carritos recuperables y tareas directas

**Publicado el 19 de octubre de 2026.** [Registro de publicación y pendientes](../interfaz/publicacion-20261019.md). Las notas de preparación local de este documento describen el estado anterior al despliegue.

Entrega local en `mejora/venta-recuperable-y-atajos`. No publica cambios, no
requiere migraciones y no cambia cuentas, base, DNS ni servicios de producción.
Conserva la reorganización visual y el botón «Volver a Más» de la etapa anterior.

## Recuperar el trabajo

El POS guarda automáticamente un carrito por cuenta y navegador. Al volver a
entrar, elegir **Recuperar carrito** o descartar expresamente el carrito local.
Un carrito ordinario guarda SKU, cantidad, identificador, fecha y descuento
propuesto; no guarda precios como autoridad, cliente, documento, dinero recibido
ni verificaciones de pago. Un pedido web o venta pendiente guarda su referencia
para consultar su estado real; no se convierte en otra venta presencial.

Al recuperar, el POS consulta los productos en la API, muestra precios y stock
actuales y exige revisar esa información. Los importes y las verificaciones de
pago empiezan vacíos. El servidor vuelve a validar los precios y existencias
al confirmar. Si un producto ya no existe, la recuperación falla sin cobrar;
se puede revisar el historial o descartar el carrito. Más de siete días requiere
descartarlo y preparar otra venta con datos actuales.

El carrito no reserva existencias, no abre caja y no crea ventas. El personal
debe iniciar sesión en su propia cuenta; el guardado local no amplía permisos.
Se recupera solo en este navegador/equipo y origen. No sincroniza carritos entre
dispositivos. Borrar los datos del sitio elimina esta recuperación local.

## Conexiones y dos pestañas

Un cobro con resultado incierto tiene prioridad sobre recuperar/descartar un
carrito. Se conserva el mismo payload e identificador de operación en
almacenamiento persistente, también al cerrar y abrir una pestaña. Seleccionar
**Recuperar mismo intento**; no generar otro pago ni alterar sus datos.

El intento incluye los datos mínimos necesarios para repetir exactamente la
solicitud original, incluidos los datos de cliente y referencias de pago que
se hubiesen introducido. No incluye la contraseña ni el token de sesión. No
se reutilizan sus verificaciones para una venta nueva. Se elimina tras resolver
el resultado; no vence automáticamente un cobro incierto, porque descartarlo
podría permitir un cobro duplicado. Proteger el acceso al equipo de caja.

Web Locks coordina las operaciones de la cuenta entre pestañas del mismo origen;
el identificador del carrito se conserva al recuperar y la idempotencia del
servidor protege los reintentos. No se pueden sobrescribir silenciosamente
carritos de otra pestaña con identificadores diferentes. Si el almacenamiento
falla o está corrupto, el POS bloquea nuevas operaciones y pide revisar el
historial/contactar al administrador. No se ofrece un botón que borre a ciegas
un intento financiero incierto.

Requiere almacenamiento local disponible y un navegador con Web Locks en un
contexto seguro (HTTPS; localhost para la revisión). El POS avisa si no puede
coordinar pestañas y no envía la operación. No desactiva esta protección para
compatibilizar navegadores antiguos.

## Cobrar más rápido

- **Importe exacto:** asigna al efectivo el saldo pendiente después de los otros
  métodos y rellena recibido con ese mismo importe.
- **S/ 20, 50, 100 y 200:** reemplaza el efectivo recibido con el total físico
  seleccionado; no suma automáticamente billetes ni modifica otros métodos.
- Cambiar importe, método, referencia o recibido desmarca su verificación.
  El cajero debe contar/verificar y marcarla de nuevo. Ningún atajo confirma.
- El vuelto se calcula con céntimos enteros. La API conserva sus validaciones
  de importes, cuenta, caja, precio y stock.

## Filtros y siguientes pasos

- Catálogo: conserva la búsqueda por cuenta. Un acceso del inicio a un producto
  con stock bajo abre el catálogo con su nombre como búsqueda explícita.
- Inventario: conserva búsqueda, página de productos y filtros/página del
  Kardex; al recuperar vuelve a consultar datos en la API.
- Pedidos: conserva filtros entre visitas y en la URL. Cada pedido muestra su
  siguiente tarea: verificar/cobrar, registrar despacho o registrar entrega,
  según estado y devoluciones. Los cambios de despacho/entrega exigen confirmar
  que ocurrieron; la API sigue decidiendo qué transición está permitida.
- Historial POS: conserva búsqueda/estado y la selección de venta en la URL.
  La búsqueda se limita a las últimas 100 ventas que devuelve la API existente.
- Caja: conserva filtro por turno abierto/cerrado en el historial de los últimos
  100 turnos. La caja propia activa sigue determinando si puede cobrar.
- Reportes: recuerda filtros. El acceso de stock bajo abre ese tipo de reporte.
- Las listas conservan su posición vertical en la sesión del navegador cuando
  hay contenido cargado suficiente para restaurarla. No congela datos ni hace
  pasar un resultado guardado por información actual del servidor.

En Inicio, pedidos pendientes, stock bajo y cajas abiertas llevan a las listas
o reportes correspondientes con su filtro. No se presentan sumas de una lista
limitada como totales de todo el negocio.

## Revisar localmente

Ejecutar `npm run preview:local` en este checkout. Abrir
http://127.0.0.1:5180/revision-local para las cuentas y contraseña sintéticas.
No usar esos accesos en producción ni cargar fixtures en Neon.

```powershell
node scripts/verify-pos-recovery-ui.mjs
node scripts/verify-pos-ui.mjs
node scripts/verify-staff-system-ui.mjs
node scripts/verify-inventory-ui.mjs
node scripts/verify-panel-workspace-ui.mjs
npm run build:all
git diff --check
```

Las pruebas usan PostgreSQL Docker desechable y bloquean conexiones del navegador
a hosts externos. Evidencias: [recuperación](evidencia/resultados.json),
[ventas/caja](regresion-pos/resultados.json),
[personal](regresion-personal/resultados.json),
[inventario](regresion-inventario/resultados.json).

Se comprobaron ocho grupos de recuperación/operación, más las regresiones de
ventas/caja, personal, inventario y navegación general. Las pantallas nuevas se
capturaron en escritorio/tablet y ambos temas; no hubo errores JavaScript.
La infraestructura QA espera disponibilidad TCP de PostgreSQL para evitar
intentar migrar contra el servidor temporal de inicialización del contenedor.
Ambos builds y `git diff --check` también se ejecutaron. No se cambiaron versiones
de dependencias ni se usaron credenciales/productos reales en estas pruebas.

## Publicación y recuperación

Esta etapa queda local para revisión. Para publicar posteriormente, mantener los
dos builds separados, API integrada y orígenes actuales; no ejecutar migraciones
ni seeds. Validar la nueva interfaz antes de anunciarla a los operadores.

Conservar los registros `tecruta:pos-attempt:*` ante una incidencia; revisar su
resultado en el servidor. No limpiar datos del navegador, cambiar de origen o
volver a un frontend que ignore intentos persistentes mientras haya cobros por
recuperar. Revertir interfaz no permite revertir ventas, caja ni Kardex.
