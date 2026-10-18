# Sistema integrado de TecRuta: entrega para revisión

> Nueva organización visual preparada localmente en `mejora/panel-operacion-clara`:
> [diseño, rutas y capturas](../interfaz/README.md). Esta mejora todavía no se publicó;
> no modifica la base del sistema integrado ya publicado.

> **Actualización: publicado el 18 de octubre de 2026.** El estado local descrito
> en la entrega original de abajo es histórico. Consulta la
> [publicación verificada](publicacion-20261018.md) para rutas reales, migraciones,
> conservación de datos y pasos del titular. Las cuentas QA siguen siendo solo locales.

Esta entrega integra el acceso publicado (`57e106b`) con inventario, POS y caja
conservados en `c9116c0`, en la rama `implementacion/sistema-personal-integrado`.
Los cambios de esta etapa son **locales**. No se publicaron, no se conectó a la
base real, no se crearon empleados reales ni se ejecutaron migraciones de
producción. No cambia dominio, DNS, alojamiento ni PostgreSQL/Neon.

Este documento reemplaza para esta rama las instrucciones anteriores de
invitación por correo y Google en el panel. Los documentos de `docs/panel`,
`docs/inventario`, `docs/pos` y `docs/acceso-panel` conservan sus entregas históricas.

## Acceso y rutas

| Ruta del panel | Función | Perfil |
| --- | --- | --- |
| `/iniciar-sesion` | Usuario y contraseña; sin Google ni registro público | Personal |
| `/usuarios` | Crear usuarios, asignar perfil, suspender, restablecer contraseña y cerrar sesiones | ADMIN |
| `/auditoria` | Historial de acciones del personal, filtros y paginación | ADMIN |
| `/seguridad` | Cambio de contraseña y configuración del segundo factor del titular | Personal; MFA solo titular |
| `/inventario` | Identificación, códigos, etiquetas, movimientos y Kardex | ADMIN y almacén; cajero consulta |
| `/pos` | Venta con lectora y selección de pedidos web por cobrar | ADMIN y cajero/vendedor |
| `/pos/caja` | Apertura, movimientos autorizados, cierre y conciliación de suspendidos | ADMIN y cajero; conciliación ADMIN |
| `/pos/ventas` | Ventas, pagos pendientes, tickets y devoluciones | Según permisos existentes del POS |
| `/pos/reportes` | Ventas, caja, devoluciones y stock bajo; CSV | Según permisos del POS |
| `/pedidos` | Gestión administrativa de pedidos web | ADMIN |
| `/clientes` | Consulta de clientes; no asigna perfiles de trabajo | ADMIN |
| `/recuperar-contrasena` | Recuperación por correo del administrador principal | Titular |

El administrador puede usar todas las herramientas de almacén y cajero, con
cuenta y turno propios. El trabajador de almacén no entra al POS ni administra
cuentas. El cajero vende, cobra y consulta stock; no puede crear usuarios,
modificar inventario, conceder descuentos ni registrar devoluciones reservadas
al administrador. Los permisos se comprueban en la API y se vuelven a validar
en las transacciones de POS e inventario.

La tienda comercial conserva el acceso por correo, Google y recuperación para
**clientes**. Las cuentas de personal utilizan únicamente el acceso del panel;
Google de la tienda tampoco puede generar sesiones para personal. Se conservan
las cuentas y sus vínculos Google históricos; no se borran identidades.

## Manual para el administrador

1. Ingresar con su usuario. La primera vez después de esta actualización deberá
   cambiar la contraseña antes de operar. No se crea ni modifica su contraseña
   real al preparar esta entrega.
2. Abrir **Usuarios y permisos → Crear trabajador**. Indicar usuario único,
   nombre, apellido, perfil y contraseña temporal. Puede generar una aleatoria.
   No se pide correo y no se fabrica una dirección: `email` queda NULL.
3. Entregar usuario y temporal por un canal privado. No se envía correo. La
   temporal requiere 12 caracteres, admite hasta 72 bytes UTF-8 y vence en 24 h.
   La contraseña se almacena como hash bcrypt; la API nunca la devuelve.
4. Si la persona olvida su contraseña, verificar su identidad y utilizar
   **Restablecer contraseña**, dejando un motivo y entregando una nueva temporal.
   Se invalidan todas sus sesiones y debe cambiarla al siguiente acceso.
   El administrador no puede leer la contraseña anterior.
5. Para una baja, **Editar acceso → Suspender acceso**, dejando motivo. Se
   suspende inmediatamente, también si existe una caja abierta. Se conservan
   usuario, ventas, pagos, stock, Kardex y turnos. Reactivar no restaura sesiones
   antiguas; la persona debe ingresar nuevamente.
6. Si quedó una caja abierta de un suspendido, contar el efectivo físico y abrir
   **Punto de venta → Caja → Conciliar caja de personal suspendido**. Elegir el
   turno, importe contado y motivo. No se reasigna la caja. Se registra el
   administrador, esperado, contado y diferencia; el cierre es definitivo e
   idempotente. El servidor rechaza cajas activas de empleados no suspendidos.
7. Consultar **Historial de personal**. Registra altas, cambios de perfil,
   suspensión/reactivación, contraseñas restablecidas/cambiadas, revocación de
   sesiones, ingresos y configuración MFA. La tabla es append-only también por
   trigger SQL; no tiene endpoints de edición/borrado. Nunca guarda contraseñas,
   claves TOTP ni códigos de respaldo. Ventas, caja y Kardex mantienen sus
   historiales específicos con el responsable de cada operación.

Cada cuenta es individual. Cambiar el perfil exige cerrar primero su caja; la
suspensión de seguridad no se bloquea por esa condición. No se permite modificar
el propio acceso ni suspender/degradar accidentalmente al titular de recuperación.
El endpoint legado que convertía clientes en empleados devuelve 410: el personal
se gestiona en su sección propia.

## Manual para cajero y almacén

- Ingresar con el usuario entregado, sin correo y sin Google. Antes de operar,
  cambiar la contraseña temporal por otra propia de al menos 12 caracteres.
  La aplicación y la API bloquean las operaciones hasta completar el cambio.
- Si la olvida o vence la temporal, contactar al administrador. El login muestra
  esa indicación y no permite recuperación del trabajador mediante correo.
- Cajero: abrir su turno con el efectivo físico inicial; escanear agrega una
  unidad y repetir incrementa cantidad. Confirmar únicamente después de contar
  el efectivo o verificar el abono real. Yape, Plin y transferencias no aumentan
  el efectivo de caja. Una captura no acredita dinero.
- Pedidos web: usar la lista **Pedidos web por cobrar** o cargar su referencia.
  El cobro utiliza las líneas y reserva del pedido original; no descuenta stock
  por segunda vez. Los pedidos pendientes/confirmados se muestran paginados.
- Una venta POS con pago pendiente no cobra ni reserva stock; al cobrar se
  revalidan precio, disponibilidad y métodos. El pedido web pendiente sí reserva
  según el flujo existente; su cancelación devuelve stock una vez.
- Almacén: registrar borradores de entradas/salidas con motivo, referencia y
  costos solo cuando se conocen; confirmar para afectar stock. Usar Kardex para
  comprobar trazabilidad y CSV. Corregir mediante reversión enlazada, sin borrar
  movimientos. El escaneo por sí solo no confirma movimientos.
- Terminar el turno contando el efectivo y registrando el cierre. Los cierres
  no se reabren. Devoluciones, anulaciones y ajustes requieren los permisos
  correspondientes y conservan sus referencias originales.

Las sesiones del personal tienen duración máxima de 12 horas y caducan tras
30 minutos de inactividad. «Recordar sesión» conserva el token en el navegador,
pero no extiende esos límites. Suspender, restablecer contraseña o cambiar
permisos invalida las sesiones. El cierre de caja es una operación distinta del
cierre de sesión: salir del panel no cierra ni modifica la caja.

## Recuperación y segundo factor del titular

Solo el administrador principal designado conserva recuperación por correo.
La migración reconoce la cuenta ADMIN con alias normalizado `admin1234` y correo
existente; no cambia su dirección ni contraseña. El resto de trabajadores no
recibe códigos por correo aunque conserve uno de una versión anterior.

El titular puede activar una aplicación TOTP en **Contraseña y seguridad**.
Debe confirmar su contraseña, introducir manualmente la clave en una aplicación
autenticadora y confirmar con un código real. Se muestran ocho códigos de
respaldo una sola vez; cada uno sirve para un ingreso y se guarda hasheado.
Tras activar se requiere ingresar otra vez. Esperar al siguiente código de la
aplicación si el utilizado en la activación aún no cambió: no se acepta dos veces.
La recuperación de contraseña por correo no desactiva MFA ni sustituye el
segundo factor. Desactivarlo exige contraseña y código o un respaldo válido.

El servidor requiere **MFA_ENCRYPTION_KEY** (32 bytes aleatorios codificados en
base64, guardados en el gestor de secretos). Las claves TOTP se cifran con
AES-256-GCM; no se utilizan JWT_SECRET como clave de cifrado ni secretos en
variables VITE. Los desafíos duran cinco minutos, admiten cinco intentos y se
consumen una vez. Se conservan los límites por IP existentes del login.

La funcionalidad MFA está implementada y probada localmente. No está activada
para cuentas reales; al faltar la clave de servidor, la configuración devuelve
un error explícito. Guardar la clave de cifrado junto al plan de recuperación;
perderla impide descifrar los segundos factores. No rotarla sin un procedimiento
de recifrado. Si el titular pierde la aplicación y todos los respaldos, requerirá
recuperación operativa verificada; no hay un bypass público de MFA.

## Revisión local

Desde esta carpeta de trabajo, con Docker Desktop iniciado y dependencias
instaladas mediante los lockfiles existentes:

```powershell
npm.cmd run preview:local
```

Abrir `http://127.0.0.1:5180/revision-local`. Allí aparecen los usuarios y la
contraseña **exclusivamente sintéticos**; no usar credenciales del negocio.
Panel `http://127.0.0.1:5180`, tienda `http://127.0.0.1:5181`.
La base es PostgreSQL local desechable, el correo se intercepta y las claves de
prueba viven en memoria. Al detener con Ctrl+C se elimina la base de revisión.
No persisten datos entre reinicios; dentro de la revisión sí persisten al recargar.

Validación:

```powershell
npm.cmd run test:inventory
npm.cmd run test:pos
npm.cmd run test:staff
npm.cmd run qa:inventory-ui
npm.cmd run qa:pos-ui
npm.cmd run qa:staff-ui
npm.cmd run build:all
git diff --check
```

Los guiones de UI requieren Edge y `playwright-core` en `TECRUTA_QA_TOOLS`, como
las entregas anteriores. Los tests Prisma generan un cliente aislado y solo
permiten URLs loopback de bases QA. No leen `.env` reales. Los builds se validan
con `envFile:false`. No se cambiaron las versiones ni lockfiles.
Las suites de invitaciones/Google del panel de las entregas antiguas describen
contratos reemplazados; `test:panel` y `qa:panel-ui` apuntan ahora al flujo vigente.

Evidencias:

- [Usuarios, escritorio claro](evidencia/usuarios-escritorio-light.png)
- [Usuarios, tablet oscuro](evidencia/usuarios-tablet-dark.png)
- [Cambio obligatorio](evidencia/cambio-obligatorio.png)
- [Venta del cajero](evidencia/venta-cajero-confirmada.png)
- [Conciliación administrativa](evidencia/conciliacion-supervisor.png)
- [Auditoría](evidencia/auditoria-personal.png)
- [Regresión POS](regresion-pos/resultados.json)
- [Regresión inventario](regresion-inventario/resultados.json)

Publicación y recuperación: [procedimiento](publicacion-recuperacion.md).

## Límites reales

- Esta versión todavía no está en internet ni migrada sobre Neon real.
- `admin.tecruta.com` continúa pendiente de DNS. La dirección provisional no
  cambia; el origen se configura mediante las variables existentes.
- SUNAT sigue pendiente de proveedor, contrato, configuración y credenciales.
  Se imprime ticket interno expresamente no fiscal; no se simula emisión.
- Google y recuperación por correo de clientes se conservan; no se enviaron
  correos reales ni se comprobó posesión de buzones durante estas pruebas.
- La lectora se prueba como teclado/Enter; impresión física, papel y lectura
  del dispositivo real requieren la comprobación del operador.
- No se crea utilidad histórica: costos desconocidos siguen indicados como tales.
- Se mantienen avisos previos del build por tamaño del visor 3D y carga mixta
  de ubigeo. No se amplió el alcance con actualizaciones de dependencias.
