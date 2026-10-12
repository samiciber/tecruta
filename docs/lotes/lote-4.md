# Lote 4: autenticación y sesión

## Resumen

H02–H03: Google exige identidad verificada; state/cookie de un uso y PKCE.
H04–H05: códigos con hash, 15 minutos y contador; respuestas genéricas uniformes.
H06: código de intercambio breve en URL; tokenVersion y cerrar todas las sesiones.
H16–H17: red/base fallida conserva sesión; Recordar sesión elige el almacenamiento.
Todo validado localmente; sin escrituras, correos ni inicios de sesión en producción.

Se entrega código para revisión/despliegue, no una prueba de Google o Resend
productivos. La propuesta de cookies HttpOnly para **sesiones** queda solo por
escrito, como se solicitó. La cookie de **flujo OAuth** sí forma parte de H03.

## Archivos

| Ruta | Qué cambió |
|---|---|
| `server/prisma/schema.prisma` | Once campos nullable en User y modelos OAuthFlow/AuthExchange. |
| `server/prisma/migrations/20261012000002_add_secure_auth_codes_oauth_sessions/migration.sql` | Columnas, dos tablas, índices/FK y eliminación de códigos antiguos en texto claro; transacción. |
| `server/src/lib/authSecurity.js` | CSPRNG, HMAC, TTL, política Google, cookie de flujo y respuesta uniforme. |
| `server/src/lib/authCodes.js` | Emisión/consumo con bloqueo de fila, caducidad, cooldown y contador por cuenta/propósito. |
| `server/src/lib/oauthService.js` | State y canje de un uso en base, vinculación y verificación de la pestaña. |
| `server/src/lib/google.js` | S256 y code_verifier, timeouts y errores sin cuerpos del proveedor. |
| `server/src/lib/mailer.js` | Timeouts, mensaje de caducidad y errores sin detalle del proveedor. |
| `server/src/lib/token.js` | JWT HS256 con versión de sesión y fallo claro si falta secreto. |
| `server/src/middleware/auth.js` | Compara versión; errores de JWT 401, errores de base 5xx; no degrada token inválido a invitado. |
| `server/src/middleware/errorHandler.js` | Logs acotados sin cuerpos/credenciales; errores de infraestructura siguen 5xx. |
| `server/src/routes/auth.routes.js` | Contratos uniformes, consumo transaccional, Google, cambio de contraseña y logout-all; adapters de pruebas. |
| `src/services/sessionStorage.js` | Almacén elegido, limpieza, almacenamiento bloqueado y clasificación de 401. |
| `src/services/googleFlow.js` | Prueba aleatoria por pestaña para el canje; recuerda preferencia de persistencia. |
| `src/services/api.js` | POST de canje Google y cerrar todas las sesiones. |
| `src/context/AuthContext.jsx` | Preserva sesión ante fallos, reintenta, respeta preferencia y descarta respuestas de operaciones anteriores. |
| `src/components/auth/GoogleButton.jsx` | Inicia prueba por pestaña antes de navegar; botón con estado ocupado/error. |
| `src/components/auth/SessionUnavailable.jsx` | Estado compartido con reintento sin borrar la sesión. |
| `src/components/admin/RequireAdmin.jsx` | Error de comprobación antes de redirigir por ausencia de rol. |
| `src/components/account/AccountShell.jsx` | Reintento de sesión en las páginas que usan la estructura compartida. |
| `src/pages/GoogleCallback.jsx` | Consume código por POST una vez; limpia URL; rechaza `?token=` antiguo. |
| `src/pages/Login.jsx` | Preferencia para Google y mensajes de vinculación/indisponibilidad. |
| `src/pages/Register.jsx` | Mensaje genérico; obtiene correo normalizado del formulario, sin asumir cuenta creada. |
| `src/pages/VerifyEmail.jsx` | Mensaje uniforme, cooldown de 60 segundos y seis entradas sin desbordamiento. |
| `src/pages/ForgotPassword.jsx` | Copia y estados acordes a solicitud genérica aceptada. |
| `src/pages/Account.jsx` | Espera/reintento de sesión, logout tras cambio de contraseña y cerrar todas las sesiones. |
| `src/pages/OrderHistory.jsx` | Espera/reintento de sesión; no muestra login por una comprobación fallida. |
| `src/pages/Addresses.jsx` | La misma distinción entre espera/error y ausencia de sesión. |
| `tests/lote-4.test.js` | Siete pruebas ligeras de identidad, hashes, cookie, prueba por pestaña y almacenamiento. |
| `server/prisma/tests/lote-4.test.mjs` | Trece pruebas PostgreSQL/HTTP con Google y correo sustituidos. |
| `server/README.md` | Contratos y comandos de validación. |
| `docs/lotes/lote-4.md` | Este informe y procedimiento de despliegue/reversión. |

Rama desde main actualizado (`8470fc1` al comenzar). Los PR de los lotes
anteriores aún no estaban fusionados. No se duplican sus cambios ni se modifican
`.env`, dependencias, lockfiles, migraciones históricas o archivos reservados
para los cambios de Home de Claude.

## Decisiones y comportamiento

### H02–H03: identidad Google y flujo OAuth

Se exige `sub` no vacío y string, correo válido y `email_verified === true`
(no se acepta el string "true"). Se obtiene el perfil solo con el acceso
intercambiado por el backend frente a los endpoints HTTPS fijos de Google.

- GoogleId existente: permite acceso solo si la cuenta local está verificada.
- Sin GoogleId pero correo local verificado: vincula ese sub, conservando
  contraseña, nombre y rol. Si ya existe otro sub, rechaza sustituirlo.
- Correo local sin verificar: bloquea la vinculación; no cambia verified ni
  credenciales. Verificación por correo o recuperación son pasos separados.
  Recuperar con código válido cambia la contraseña y confirma propiedad del correo.
- Cuenta nueva: CUSTOMER, correo verificado por Google y contraseña aleatoria
  inutilizable para un login conocido; no toma un rol del perfil del proveedor.

El inicio crea state aleatorio de 256 bits. La base guarda solo hashes de state
y de la unión al navegador, junto al challenge de la pestaña y expiración.
Cookie firmada HttpOnly y SameSite=Lax, host-only, Path=/, máximo 5 minutos;
en HTTPS/producción usa Secure y prefijo `__Host-`. Contiene la prueba del
navegador y el verifier de PKCE, no una sesión. PKCE usa S256 y el backend envía
code_verifier a Google. Se consume state antes de contactar al proveedor; un
callback concurrente/repetido, vencido o de otro navegador no alcanza Google.
Hay un flujo activo por navegador: iniciar otro sustituye la cookie anterior.

### H04–H05: códigos y respuestas

`crypto.randomInt(0, 1000000)` genera seis dígitos (incluidos ceros iniciales).
Se almacena HMAC-SHA256 con JWT_SECRET y dominio/cuenta/propósito; no SHA simple
que permita enumerar offline el millón de códigos sin el secreto del servidor.
Verificación y recuperación tienen hashes, expiraciones y contadores separados.

Cada código dura 15 minutos. Cinco fallos bloquean ese propósito/cuenta por 15
minutos e invalidan el código. Reenviar requiere 60 segundos y **no reinicia** los
fallos ni salta el bloqueo; después de vencer el código/bloqueo se puede emitir
otro. Un bloqueo de fila evita que intentos simultáneos pierdan incrementos o
que dos consumos correctos usen el mismo código. Un intento fallido se confirma
en la transacción para conservar su contador.

Registro, reenvío y solicitud de recuperación devuelven exactamente 202 y
`{ ok, message }` para correos nuevos, existentes, verificados o desconocidos,
incluidos fallos del correo. No devuelven emailSent ni revelan 404/409. Registrar
otra vez nunca cambia contraseña/nombre de una cuenta existente. La SPA usa el
correo del formulario y un mensaje condicional, sin prometer que el correo llegó.

El envío se intenta en segundo plano después de guardar el hash: la respuesta
no espera al proveedor ni diferencia su disponibilidad según la cuenta. Es una
tarea en memoria, no un outbox duradero; si el proceso cae, el usuario puede
reenviar tras el cooldown. Los logs son genéricos. Se mantiene el rate limit
existente por IP, además del nuevo contador por cuenta. No se garantiza igualdad
exacta de tiempos de consultas distintas; lo verificado es estado/cuerpo uniforme
y ausencia de espera condicional al proveedor.

### H06: canje e invalidación

El callback de API redirige a `/auth/google/callback?code=...`, nunca con JWT.
El código aleatorio dura 60 segundos y se guarda solo como hash. POST
`/api/auth/google/exchange` lo consume una vez y responde token/user con
Cache-Control no-store. El frontend elimina la query antes de canjear.

Como www.tecruta.com y onrender.com son sitios diferentes, una cookie Lax de API
no viajaría en ese POST de la SPA. Se exige además una prueba aleatoria guardada
en sessionStorage de la pestaña original; solo su S256 challenge llega al inicio
OAuth. Un código copiado de la URL sin esa prueba no se canjea. No se habilita
credentials/include ni se migran sesiones a cookies para este cambio.

tokenVersion nullable tiene default 0; lectura NULL o JWT antiguo sin versión
equivalen a 0. Cambiar/restablecer contraseña y cerrar todas las sesiones lo
incrementan con bloqueo de fila; los JWT anteriores dejan de validar. Las
versiones NULL también se incrementan correctamente (no se usa NULL + 1).
El canje guarda la versión de la cuenta al emitirlo: una revocación posterior
impide que un canje pendiente emita otra sesión. El frontend limpia su sesión
tras cambio de contraseña/logout-all exitosos. El cierre local sigue siendo local.

Propuesta posterior, **no implementada**: mover API a un dominio del mismo sitio
(por ejemplo api.tecruta.com), usar cookies de sesión host-only HttpOnly/Secure,
SameSite=Lax, CORS con origen exacto y credenciales, y protección Origin/CSRF para
escrituras. Revisar rotación/expiración y cierre de sesiones usando tokenVersion.
Con Render en otro sitio no basta cambiar un header: hay que revisar la política
de cookies y el dominio primero. Requiere un lote propio, no una activación aquí.

### H16–H17: sesión en navegador

Un JWT inválido, vencido, usuario inexistente o versión distinta produce 401.
Un fallo de base/infraestructura se propaga como 5xx; no se trata como JWT inválido.
Un token proporcionado e inválido no se degrada a invitado en optionalAuth.

AuthContext elimina la sesión solo por 401 al restaurarla. En errores de red,
403/429 o 5xx conserva token y usuario ya conocido; si todavía no conoce el
usuario, mantiene pendiente la restauración del carrito/guardados. Las páginas
de cuenta y admin ofrecen Reintentar sesión en lugar de pedir login por un fallo.
Las respuestas de login/perfil anteriores a logout u otro login no reabren sesión.

Recordar marcado: token en localStorage. Desmarcado: sessionStorage de la pestaña.
Se borra el almacén opuesto; logout borra ambos. Google conserva la elección del
botón de login; desde registro usa por defecto solo la pestaña. Almacenamiento
bloqueado muestra error y no afirma haber aplicado una preferencia que no guardó.

## Cómo probar y evidencia

Requiere Docker y dependencias de raíz/servidor instaladas desde lockfiles, con la
migración del Lote 2 integrada. Desde la raíz:

```bash
DATABASE_URL='postgresql://qa_unused@127.0.0.1:1/unused' server/node_modules/.bin/prisma generate --schema server/prisma/schema.prisma
node --test tests/lote-4.test.js
node --test server/prisma/tests/lote-4.test.mjs
npm run build
git diff origin/main --check
```

Generate usa un marcador local y no conecta a la base. La suite apunta todos sus
procesos a un PostgreSQL desechable con puerto aleatorio ligado a loopback y al
socket Docker local explícito. Preserva proxy/credenciales de Docker; PostgreSQL
no hace solicitudes HTTPS. No ejecuta seeds ni usa la base/secretos de `.env`.
Google y correo son adapters locales sustituidos; no se envían mensajes reales.
Al terminar elimina su contenedor y volúmenes anónimos.

Como el Lote 2 aún no estaba fusionado, se probó con una copia temporal, idéntica,
de su migración mediante TECRUTA_QA_MIGRATIONS_DIR. No se copió a este PR. Con
esas siete migraciones, el esquema de este PR se reproduce desde cero y desde
las seis anteriores; diff desde la base e historial contra schema.prisma vacío.
Al integrar el Lote 3, su migración de Order se conserva y la suite cuenta el
historial disponible, sin fijar artificialmente siete como límite.

| Hallazgo / prueba | Resultado |
|---|---|
| Migración | Cuenta anterior conserva contraseña, correo, nombre, rol y verified; códigos en claro quedan NULL y versión 0. Reaplicar deploy no ejecuta nada. |
| H02 | Rechaza sub ausente/vacío y email_verified falso/string. Cuenta pendiente no se vincula ni verifica. Verificada se vincula sin cambiar contraseña/nombre/rol; otro sub no reemplaza la unión y perfil nuevo con role ADMIN queda CUSTOMER. |
| H03 | Cookie HttpOnly/Lax/300 s; en producción Host/Secure/Path=/ sin Domain. Sin cookie, cookie de otro flujo, vencido o replay: no contacta Google. Dos callbacks simultáneos: uno consume state; stub comprueba PKCE S256/verifier. |
| H04 | Hash distinto al código; vence a los 15 minutos; dos consumos simultáneos solo uno 200. Cinco fallos bloquean cada propósito; reenviar no desbloquea ni reinicia intentos. |
| H05 | 202 y cuerpo idénticos en registro/reenvío/recuperación con correo nuevo/existente/desconocido y fallo del mailer. Registro duplicado conserva contraseña/nombre. |
| H06 | URL sin JWT; canje requiere prueba de pestaña, vence a los 60 s y solo uno de dos POSTs simultáneos obtiene sesión. logout-all/cambio/reset invalidan JWT previo, incluida versión legacy/NULL y canje pendiente. |
| H16 | Fallo de base esperado 500 en middleware requerido/opcional; JWT inválido 401. Navegador conserva sesión en red/503, reintenta y borra ambos almacenes solo al recibir 401. Perfil tardío no restaura tras logout-all. |
| H17 | Login y Google usan exclusivamente el almacén elegido; recarga misma pestaña restaura. Google hace un solo POST incluso bajo StrictMode; prueba temporal se elimina. |

**7/7 pruebas ligeras y 13/13 pruebas PostgreSQL/HTTP pasan**, sin omitidas.
Los fallos de correo/base se simulan deliberadamente; no son incidencias de un
servicio externo. Vite build código 0 y diff limpio; permanecen avisos previos
de ubigeo y tamaño del módulo 3D.

Navegador local con API interceptada y datos públicos de referencia: 390, 768,
1024, 1280, 1440 y 1920 px, claro y oscuro. Login, verificación, recuperación,
sesión indisponible en cuenta/pedidos/direcciones/estructura común, cuenta lista
y callback rechazado: **108 comprobaciones** sin desbordamiento
(`scrollWidth <= clientWidth`) ni errores JavaScript. Matriz, checks y capturas
en `/workspace/audit-tecruta/lote-4/`; no se añaden dependencias de navegador.

Pasos manuales, solo contra la API/base desechable:

1. Registrar correo ficticio y solicitar/repetir códigos; comprobar mensaje
   genérico. Verificar con el mailer stub, agotar cinco fallos y comprobar bloqueo.
2. Iniciar Google con prueba por pestaña; probar cookie ausente, state repetido,
   perfil no verificado y canje repetido/vencido. El stub reemplaza consentimiento.
3. Iniciar sesión con recordar marcado/desmarcado; inspeccionar **solo presencia**
   en localStorage/sessionStorage, recargar y comprobar cuenta restaurada.
4. Simular /auth/me 503 o red caída: cuenta/admin mantienen sesión y ofrecen
   reintento. Cambiar a 401: se limpia la sesión y aparece acceso anónimo.
5. Cambiar contraseña o cerrar todas las sesiones: tokens antiguos fallan y
   nuevo login funciona. Enviar perfil tardío después de salir no reabre cuenta.
6. Repetir los estados visuales en los seis anchos y ambos temas; teclado para
   botones, códigos y reintento. No imprimir contraseñas, códigos, cookies o JWT.

## Despliegue productivo: instrucciones, no ejecutadas

1. Fusionar los lotes anteriores y este PR; revalidar el árbol final. Resolver
   primero el historial del Lote 2 según su procedimiento y conservar todos los
   archivos de migración aplicados. Mantener las correcciones de pedidos del Lote 3.
2. Coordinar mantenimiento del acceso/recuperación mientras se publican API y
   SPA. El cliente antiguo espera token en la URL/emailSent y no envía challenge;
   el nuevo contrato debe llegar a ambos lados junto. Sesiones ya emitidas de
   versión 0 se mantienen hasta una revocación, no se cierran todas al migrar.
3. Respaldo pg_dump con conexión directa/SSL desde un entorno seguro; comprobar
   restauración en una base desechable. Seguir el procedimiento del Lote 2 sin
   imprimir credenciales, editar `.env` ni subir el respaldo a Git.
4. Revisar `prisma migrate status` y diff datasource → datamodel con Prisma 5
   fijado en lockfile. Tras aplicar lotes previos, debe quedar esta migración:
   once columnas nullable, dos tablas y sus índices/FK, sin cambios de roles o
   contraseña. Revisar también el UPDATE que **invalida códigos anteriores en
   texto claro**; sus destinatarios deberán solicitar nuevos. No marcarla como
   aplicada para saltarse ese UPDATE si no se ejecutó/concilió.
5. El operador, desde server, ejecuta `npx --no-install prisma migrate deploy
   --schema prisma/schema.prisma`, confirma status al día/diff vacío y ejecuta
   `npx --no-install prisma generate --schema prisma/schema.prisma` para el build
   de la API. No db push, reset, dev ni seeds en producción.
6. Publicar API y SPA coordinadas. Mantener GOOGLE_CALLBACK_URL en
   /api/auth/google/callback, GOOGLE_CLIENT_ID/SECRET, JWT_SECRET y CORS_ORIGIN
   correctos, por configuración segura. HTTPS es necesario para cookie Secure
   y Web Crypto; no desactivar Secure/SameSite ni aceptar state legacy como atajo.
7. Verificar salud/lecturas y pedir al operador la prueba real de consentimiento
   y entrega de correo. No usar cuentas o registros reales para nuestras pruebas
   automáticas; cualquier validación productiva adicional requiere su alcance
   específico. Cerrar mantenimiento tras validar contratos publicados.

## Riesgos y reversión

- Migración invalida códigos en claro existentes; no altera contraseñas, roles o
  identidad de usuarios anteriores. Solicitar nuevos códigos tras desplegar.
- Cambio de contrato Google y acciones genéricas: coordinar clientes/SPA. Un
  error de entrega no se revela al solicitante para evitar enumeración; reenvío
  disponible. La política de unión no reemplaza vínculos existentes.
- JWT_SECRET protege sesiones, hashes de códigos y cookie de flujo. Rotarlo
  invalida esos elementos: emitir códigos/flujo nuevos. No se rotó en este lote.
- Sessions siguen en storage del navegador como se pidió. La propuesta de
  cookies de sesión queda pendiente; no se afirma haber eliminado riesgo de XSS.
- Antes de aplicar: revertir PR/commits basta. Después: un revert de Git no
  devuelve códigos anteriores ni revierte la base. Conservar columnas/tablas;
  preparar corrección/reversión revisada sin borrar usuarios, historial ni hashes.
  Mantener mantenimiento si se cambia contrato. Restaurar respaldo necesita
  considerar escrituras posteriores; no se entrega down destructivo.
- Volver al código anterior reintroduciría los hallazgos y podría permitir JWT
  sin control de versión; no usarlo como reversión rutinaria tras revocar sesiones.

## Lo que no se probó

No se conectó a Neon/Render ni se inició Google real, se leyó correo o se enviaron
mensajes reales. La entrega/consentimiento productivos, un respaldo real y el
despliegue quedan pendientes del operador. El navegador usa API interceptada;
los controles de concurrencia/consumo se prueban con PostgreSQL real desechable.
No hay usuarios/registros de producción creados o modificados ni IDs que borrar.

No se actualizan dependencias, variables de arranque, caché/fallback, admin de
catálogo, comprobantes/timeline de Mis pedidos ni archivos de Home reservados.
Los cambios en Mis pedidos/direcciones aquí son solo estados de comprobación de sesión.

Lote 4 listo. Escribe continuar para el Lote 5.
