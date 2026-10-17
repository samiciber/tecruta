# Panel TecRuta y tienda independientes — revisión local

Estado: implementado para revisión; **sin publicación, push, cambios DNS ni migraciones de producción**. Rama `implementacion/panel-separado`, basada en `97684b3` (main actualizado al iniciar). Se conservan todos los cambios locales anteriores de inventario/POS. La copia previa al trabajo está en el directorio temporal local `tecruta-antes-panel-*`.

## Qué cambia

- Una aplicación pública y otra para el personal, desde el mismo repositorio. React, Express, Prisma y PostgreSQL/Neon se conservan, junto con sus versiones y lockfiles.
- La tienda no compila pantallas de administración, inventario ni POS. El panel no compila Home, catálogo, checkout ni páginas de cuenta comercial. Una guarda del build comprueba esa separación en los módulos de los bundles.
- Se comparten componentes, estilos, autenticación y cliente API. El panel no monta los proveedores de carrito/guardados, header comercial, footer comercial ni barra de carrito. Conserva las herramientas administrativas existentes y el POS de la Parte 2.
- Navegación lateral en escritorio y desplegable en tablet/móvil, temas claro y oscuro, login del personal, cierre de sesión y regreso seguro a una ruta interna.
- La API admite una lista explícita de orígenes. Google sigue devolviendo a la tienda, mediante `STORE_ORIGIN`; ningún token de sesión se transfiere por URL al panel.
- No se introduce una migración ni se cambia el esquema para separar aplicaciones o gestionar estas cuentas. **Las migraciones previas de inventario/POS siguen pendientes de publicación.**

## Acceso y rutas previstas

| Tienda | Panel | Observación |
| --- | --- | --- |
| `www.tecruta.com` | `admin.tecruta.com` | Mismo dominio principal y datos compartidos |
| `/iniciar-sesion` | `/iniciar-sesion` | Sesiones independientes por origen |
| `/admin` anterior | `/` | Dashboard; cajero va a `/pos`, almacén a `/inventario` |
| `/admin/inventario` anterior | `/inventario` | Inventario y Kardex |
| `/admin/productos`, `/admin/pedidos` | `/productos`, `/pedidos` | Mismas herramientas |
| `/admin/home-layout` anterior | `/home-layout` | Configuración de Home conservada |
| `/pos`, `/pos/*` anteriores | `/pos`, `/pos/*` | POS, cajas, ventas y reportes |
| — | `/usuarios` | Invitaciones, roles y retiro del acceso al panel |
| `/admin/clientes` anterior | `/clientes` | Asignar un rol a una cuenta que ya existe |

Los demás sufijos `/admin/...` conservan su correspondencia en la raíz del panel. Hay compatibilidad en React mientras se revisa; las redirecciones HTTP están preparadas en `deploy/vercel-store.json` y todavía no se activan. Las rutas antiguas también se normalizan dentro del panel, conservando consulta y fragmento.

## Usuarios y permisos

- `ADMIN`: todas las herramientas de administrador, almacén y cajero; cada turno de caja sigue siendo individual y las reglas de ventas/movimientos inmutables se mantienen.
- `WAREHOUSE`: inventario con las capacidades de la Parte 1. Sin acceso a clientes, configuración o POS.
- `CASHIER`: POS, caja propia, reportes permitidos y consulta del inventario. Descuentos, reembolsos y ajustes conservan sus restricciones anteriores.
- `CUSTOMER`: tienda pública; rechazado por el login del panel y los endpoints internos.

Desde **Usuarios y permisos**, un ADMIN invita a una persona con nombre, apellido, correo y rol. Se crea una contraseña aleatoria desconocida, el estado queda sin verificar y se envía un código temporal al correo mediante Resend. El trabajador abre **Activar cuenta o recuperar contraseña**, introduce su correo y elige **Ya tengo un código…** para definir su contraseña. También puede solicitar otro código si venció. Se reutiliza la recuperación existente: hash del código, 15 minutos, un solo uso, límites de intentos y reenvío. El administrador nunca ve la contraseña ni recibe el código en la API.

Si el correo ya pertenece a una cuenta, no se duplica: se autoriza desde **Clientes**. Los ADMIN existentes se gestionan desde **Usuarios y permisos**. No puedes cambiar tu propio rol, lo que también impide dejar al sistema sin el último administrador mediante este panel. Cada cambio de rol invalida las sesiones previas. El endpoint anterior de cambio de rol conserva compatibilidad y las mismas guardas esenciales.

**Retirar acceso** significa asignar “Sin acceso al panel” (`CUSTOMER`), conservando la cuenta comercial y todo el historial. No se borra ni se bloquea su uso de la tienda. Puede autorizarse de nuevo desde Clientes. No es una suspensión global de la identidad. Si hay un turno de caja abierto, debe cerrarlo primero el titular; no se fuerza ni se altera una caja cerrada.

Si el proveedor rechaza el correo, la cuenta queda pendiente y la interfaz muestra el fallo: no se simula entrega. “Solicitud de envío recibida” tampoco garantiza llegada al buzón. El reenvío está disponible para cuentas pendientes. Producción requiere Resend y `PANEL_ORIGIN` configurados. En la revisión local, todos los correos se interceptan.

### Administrador inicial real

No hay contraseñas fijas, cuentas demo ni autoascenso en la aplicación desplegable. Antes de operar: registrar/verificar la cuenta del titular por el flujo existente; un operador autorizado ejecuta `npm run make-admin -- correo` desde `server`, con el entorno correcto y de forma coordinada. El script exige verificación, invalida sesiones anteriores y no establece contraseñas. No se ejecutó sobre datos reales. Los siguientes administradores pueden autorizarse mediante un ADMIN existente.

## Desarrollo y compilación

```sh
npm run dev:store       # tienda, 127.0.0.1:5173
npm run dev:panel       # panel, 127.0.0.1:5180
npm run build:store     # dist/
npm run build:panel     # dist-panel/
npm run build:all       # ambos
```

`npm run dev` y `npm run build` siguen seleccionando tienda. El modo Vite `panel` selecciona la entrada administrativa mediante alias de compilación, sin descargar la otra aplicación. El modo cambia el archivo `.env` que Vite considera; las variables comunes pueden mantenerse en `.env` o en el gestor del alojamiento. Ningún `.env` real se modificó.

Para revisar sin usar el negocio, Docker debe estar funcionando:

```sh
npm run preview:local
```

Abre `http://127.0.0.1:5180/revision-local`: instrucciones y cuentas **ficticias** para login real contra PostgreSQL local desechable. Tienda en `http://127.0.0.1:5181`. Correos interceptados visibles solo en esa página local. Los accesos de revisión están en scripts de desarrollo, no en el código de las aplicaciones ni del backend productivo. Cerrar con Ctrl+C limpia su contenedor/base; no copiar fixtures al negocio.

## Configuración por nombre, sin secretos

| Componente | Variables |
| --- | --- |
| Ambos frontends | `VITE_API_URL` (base API; acepta con/sin `/api`), `VITE_STORE_ORIGIN`, `VITE_PANEL_ORIGIN` |
| API | `DATABASE_URL`, `JWT_SECRET`, `TRUST_PROXY` existentes |
| API, transición | `CORS_ORIGINS=https://www.tecruta.com,https://admin.tecruta.com`; `CORS_ORIGIN` anterior se acepta como fallback |
| Destinos de autenticación | `STORE_ORIGIN=https://www.tecruta.com`, `PANEL_ORIGIN=https://admin.tecruta.com` |
| Correo y Google | `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` existentes |

Los orígenes no admiten comodines, rutas, credenciales ni barra final. `CORS_ORIGINS` tiene prioridad; `STORE_ORIGIN` y `PANEL_ORIGIN`, si se configuran, deben figurar en esa lista. OPTIONS permite Authorization, Content-Type e Idempotency-Key. CORS restringe al navegador; **la autorización se comprueba siempre en la API**, incluso para llamadas sin Origin.

## Publicación preparada, sin ejecutar

1. Revisar esta rama y todos los cambios locales antes de seleccionar archivos para commit; hay documentos/capturas anteriores ajenos a este alcance. Registrar SHA y despliegues/configuración anteriores sin copiar secretos a Git.
2. Ejecutar validación aislada y preparar respaldo/restauración. Si se publican inventario/POS por primera vez, seguir su [procedimiento de migraciones y corte](../pos/publicacion-recuperacion.md); separar interfaces no elimina ese requisito ni permite que APIs incompatibles escriban simultáneamente.
3. Preparar dos proyectos Vercel del mismo repositorio y SHA. Mantener el público. Configurar `npm run build:store` + `dist` y `npm run build:panel` + `dist-panel`.
4. Los archivos `deploy/vercel-store.json` y `deploy/vercel-panel.json` son **plantillas inactivas**. Para cada proyecto, seleccionar su configuración con Vercel CLI `--local-config deploy/vercel-panel.json` o `--local-config deploy/vercel-store.json`, comprobando el proyecto enlazado antes de publicar. [Opción oficial](https://vercel.com/docs/cli/global-options#local-config). No basta con guardar estas plantillas para activarlas, y un despliegue Git automático no hereda esa opción CLI. Antes de integrar, coordinar/deshabilitar la promoción automática hasta que el panel esté listo y definir la selección por proyecto para las publicaciones futuras. Conservar CSP y SPA fallback. Panel: X-Robots-Tag, meta noindex y robots.txt que prohíbe rastreo; no son medidas de autorización.
5. Publicar primero el backend compatible con dos orígenes y Google dirigido a la tienda. Mantener intacto el origen principal, www y correo. No rotar JWT_SECRET por esta separación.
6. Asociar exclusivamente `admin.tecruta.com` al proyecto del panel y aplicar el registro DNS que indique Vercel para ese subdominio; no adivinar destinos. Verificar HTTPS, login, permisos, recargas y módulos existentes con cuentas autorizadas.
7. Activar redirecciones públicas cuando el panel funcione. Usar temporalmente redirecciones no permanentes para facilitar recuperación. Verificar el mismo SHA en las aplicaciones/API compatibles, tienda, Google y cierre de sesión. No crear compras, correos ni productos QA en producción.

No se verificaron sesiones de Vercel, DNS, costos del plan ni accesos de producción: no fueron necesarios para esta etapa local. Tampoco se promete acelerar la API por separar los frontends. No se contrató ningún servicio.

## Recuperación

Conservar despliegues/configuración anteriores. Ante un fallo de separación: desactivar redirecciones, restaurar la publicación pública compatible y el panel anterior, y mantener temporalmente la lista de CORS con ambos orígenes. Conservar datos, ventas, pagos y Kardex; no restaurar una base antigua sobre operaciones nuevas para resolver un fallo de interfaz. Si las partes 1/2 ya se migraron, no recuperar una API anterior incompatible con las guardas de stock: aplicar su [plan de recuperación](../pos/publicacion-recuperacion.md). No eliminar usuarios para retirarles acceso.

## Validación

112 pruebas correctas: 8 del panel, 14 de inventario, 19 de POS, 4 de integración de catálogo/login/colecciones y 67 de regresión existente. Ambos builds, las tres revisiones de interfaz y `git diff --check` correctos. Se inspeccionaron las capturas de escritorio y móvil. La fixture antigua de integración del lote 5 se adaptó para registrar su saldo inicial mediante el mecanismo central, en vez de crear stock sin Kardex; usa todas las migraciones y un cliente Prisma temporal. No se desactivaron las guardas de inventario para probar.

```sh
npm run test:panel
npm run test:inventory
npm run test:pos
node --test server/prisma/tests/lote-5.test.mjs
node --test tests/lote-1.test.js tests/lote-3.test.js tests/lote-4.test.js tests/lote-7.test.mjs server/tests/lote-5.test.mjs server/tests/lote-6.test.mjs server/tests/lote-9.test.mjs server/tests/home-layout.test.mjs server/tests/home-final.test.mjs server/tests/home-sections.test.mjs
npm run qa:panel-ui
npm run qa:inventory-ui
npm run qa:pos-ui
npm run build:all
git diff --check
```

Pruebas de API en `server/prisma/tests/panel.test.mjs`, navegador en `scripts/verify-panel-ui.mjs`, evidencias en [evidencia](evidencia/). Ver [validacion.json](validacion.json) para los resultados. No se hicieron pruebas sobre producción. La validación real de Google, DNS, HTTPS y correo del negocio queda para la publicación autorizada; el flujo de Google conserva sus pruebas existentes y su botón en tienda, sin conexiones externas en QA.
