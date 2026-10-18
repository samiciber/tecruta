# Acceso al panel: Google y alias ADMIN

Corrección local en `correccion/acceso-panel-google-alias`, basada en `fae9594`
(separación sin inventario). La tienda, las cuentas y los roles existentes se
conservan. No se publicó, no se consultó ni modificó producción, no se cambió DNS
y no se añadieron migraciones de inventario, POS o caja.

## Uso y rutas

| Aplicación | Ruta | Acceso |
| --- | --- | --- |
| Panel provisional | `https://tecruta-panel.vercel.app/iniciar-sesion` | Usuario o correo + contraseña, o Google; solo ADMIN |
| Panel futuro | `https://admin.tecruta.com/iniciar-sesion` | Mismas funciones; requiere DNS y configuración posterior |
| Recuperación | `/recuperar-contrasena` del panel | Correo de la cuenta; código de un uso |
| Callback del panel | `/auth/google/callback` del panel | Intercambio automático; no se abre manualmente |
| Tienda | `https://www.tecruta.com/iniciar-sesion` | Conserva correo/contraseña y Google para clientes y ADMIN |

Estas direcciones describen dónde funcionará la corrección al publicarse. La
versión nueva solo está en esta rama local. Las sesiones son independientes por
origen: entrar en tienda no inicia sesión en panel. Google iniciado desde el
panel regresa al panel y a la sección segura solicitada; iniciado desde tienda
regresa a la tienda.

El alias `ADMIN1234` no crea una cuenta ni otorga ADMIN. Se guarda como
`admin1234`; al ingresar se ignoran mayúsculas y espacios al inicio/final. Entre
4 y 32 caracteres ASCII: letras, números, guion y guion bajo; sin `@`, espacios
internos o caracteres ambiguos. El índice único y la restricción SQL impiden
alias duplicados y valores sin normalizar. Los correos conservan su unicidad y
su campo independiente. Solo el procedimiento administrativo puede asignar
alias; ni registro público ni edición del perfil permiten hacerlo.

**Pendiente de decisión:** elegir a cuál de las dos cuentas ADMIN existentes se
asignará `ADMIN1234`. No se asignó a ninguna cuenta real. No hay contraseña fija
ni nueva cuenta administrativa. El administrador que antes solo usaba Google
puede usar «Recuperar contraseña» con su correo para establecer una contraseña
propia; el código vence a los 15 minutos y tiene límites de intentos. Conserva
Google, cuenta, alias y rol; revoca las sesiones anteriores.

## Controles del servidor

- `/api/auth/login` conserva el acceso por correo de la tienda.
- `/api/auth/staff-login` acepta `{ identifier, password }`, devuelve sesión solo
  para ADMIN verificado y usa un error uniforme para cuenta desconocida,
  contraseña incorrecta o acceso no autorizado. Comparación bcrypt también con
  hash ficticio para identificadores inexistentes; límite existente de 8 intentos
  fallidos por IP en 15 minutos, compartido con los otros accesos.
- `/api/auth/google?app=panel&challenge=…` admite solo `panel` o `store`; omitir
  `app` conserva el comportamiento anterior de tienda. No toma URLs de retorno
  del cliente. El destino está en la cookie HttpOnly firmada, vinculado al state.
- State, cookie, PKCE servidor→Google y prueba por pestaña se conservan. El
  código de intercambio vence en 60 segundos, se guarda hasheado y se consume
  una vez. La prueba del panel está vinculada también al destino; un código de
  tienda no funciona en `/staff-google/exchange` ni a la inversa.
- Google en panel solo resuelve ADMIN existentes y verificados; rechaza clientes
  y desconocidos sin crear cuentas ni vincularlos. El rol se vuelve a consultar
  antes de entregar sesión. Los endpoints administrativos siguen comprobando
  ADMIN en cada solicitud, aunque el rol cambie después del login.
- La URL final solo transporta el código breve de un uso, nunca JWT o token de
  Google. El callback elimina ese código de la barra y del historial actual.
- Iniciar dos flujos Google a la vez en un navegador puede invalidar el primero
  por la cookie compartida del servidor; se debe reintentar desde la pestaña
  deseada. Falla de forma segura, sin compartir sesiones entre aplicaciones.

## Google y configuración externa pendiente

No se inspeccionaron secretos ni la consola real de Google durante esta
corrección. Verificar con el responsable del proyecto en **Google Auth Platform
→ Clients**, seleccionando el cliente OAuth de tipo aplicación web usado por la
API. El URI de redirección autorizado debe coincidir exactamente con
`https://tecruta.onrender.com/api/auth/google/callback`. No reemplazarlo por el
callback del frontend: Google regresa a la API y esta resuelve el destino seguro.
Este flujo usa redirecciones de servidor y no requiere el SDK Google en el
navegador. No necesita nuevos permisos o un nuevo cliente OAuth por separar el
panel. Si la aplicación OAuth está en pruebas, comprobar sus usuarios de prueba
y su audiencia antes de habilitar el acceso real.

En Render conservar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`,
`DATABASE_URL`, `RESEND_API_KEY` y `EMAIL_FROM`; verificar su configuración sin
copiarlos al repositorio. `GOOGLE_CALLBACK_URL` debe coincidir con el URI anterior.
La recuperación requiere un remitente autorizado por el proveedor de correo.
No se comprobó la entrega de correos ni el consentimiento Google reales: las
validaciones aquí usan sustitutos de prueba exclusivamente locales.

Configuración de orígenes en API:

```dotenv
CORS_ORIGINS=https://www.tecruta.com,https://tecruta-panel.vercel.app
STORE_ORIGIN=https://www.tecruta.com
PANEL_ORIGIN=https://tecruta-panel.vercel.app
```

Conservar otros orígenes legítimos explícitos si ya existían. No usar `*` ni
`*.vercel.app`. En producción Google del panel devuelve error de configuración
si falta `PANEL_ORIGIN`; nunca redirige a localhost por defecto. CORS no sustituye
la autorización de los endpoints.

Variables públicas de ambos proyectos Vercel:

```dotenv
VITE_API_URL=https://tecruta.onrender.com
VITE_STORE_ORIGIN=https://www.tecruta.com
VITE_PANEL_ORIGIN=https://tecruta-panel.vercel.app
```

Para el dominio futuro: después de conectar DNS y verificar HTTPS, añadir
`https://admin.tecruta.com` como origen exacto en API, cambiar `PANEL_ORIGIN` y
`VITE_PANEL_ORIGIN` y reconstruir ambos frontends. Conservar temporalmente el
origen provisional mientras se comprueba el cambio. El callback autorizado de
Google sigue siendo el de la API si esta conserva su dirección.

Referencia: [documentación oficial del flujo OAuth de servidor de Google](https://developers.google.com/identity/protocols/oauth2/web-server).

## Migración y publicación posterior a la revisión

1. Revisar el diff respecto de `fae9594`: única migración nueva
   `20261018000000_admin_login_alias`. Añade `users.adminUsername` opcional, índice
   único y CHECK de formato; no rellena alias ni cambia correos, hashes, roles,
   Google IDs, productos, pedidos o existencias. La migración se probó desde cero
   y sobre el historial anterior con filas sintéticas, sin pérdida ni drift.
2. Con autorización de publicación, obtener un respaldo verificable y revisar
   `prisma migrate status` contra el destino correcto. No ejecutar `migrate
   deploy` desde ramas que incluyan inventario/POS. Confirmar que el único SQL
   pendiente es el alias. El DDL necesita un bloqueo breve de users; programar
   baja actividad, usar lock_timeout acotado y abortar/reintentar si hay bloqueo,
   sin poner la API en mantenimiento.
3. Aplicar la migración aditiva **antes** de desplegar el backend generado con
   este schema: Prisma selecciona la nueva columna y requiere que exista. El
   backend anterior funciona con la columna extra. Generar el cliente con
   `npm ci && npx prisma generate` en `server`; no cambia dependencias.
4. Configurar los orígenes y Google descritos; desplegar primero API, luego panel
   con `npm run build:panel` (`dist-panel`), luego tienda con
   `npm run build:store` (`dist`). No ejecutar seeds ni `make-admin`.
5. Tras elegir explícitamente la cuenta principal, usar el script desde un
   entorno privado que ya tenga DATABASE_URL inyectada por el gestor de secretos:

   ```powershell
   node server/prisma/set-admin-username.js --email CORREO_ELEGIDO --username ADMIN1234
   node server/prisma/set-admin-username.js --email CORREO_ELEGIDO --username ADMIN1234 --apply
   ```

   El primer comando solo valida. El segundo asigna el alias a un ADMIN existente
   y verificado, sin contraseña, sin elevar roles y sin crear usuarios. Repetir
   la misma asignación es idempotente; reemplazar un alias distinto se rechaza.
   Conflictos simultáneos se resuelven mediante el índice único. No ejecutarlo en
   producción hasta obtener la selección de cuenta y autorización de cambio.
6. El titular establece su contraseña por recuperación o ingresa con Google.
   Comprobar ambos orígenes, ADMIN, rechazo de clientes y envío real de correo
   mediante una prueba coordinada. No generar pedidos o ventas para validar login.

## Recuperación

Ante un fallo restaurar el backend/panel/tienda previos compatibles (`fae9594`) y
conservar la base en su estado actual. Mantener la columna, índice y restricción
aditivos: el código anterior los ignora. No borrar usuarios, no revertir hashes,
no restaurar dumps sobre pedidos recientes, no ejecutar down-migrations. Se
preservan pedidos y escrituras posteriores al despliegue. Conservar la
configuración previa de orígenes y secretos para revertir los despliegues.

Si el problema es una cuenta o contraseña, usar recuperación por correo y
revocación de sesiones; no crear otro ADMIN ni compartir credenciales. Si se
asignó el alias a la cuenta equivocada, detener cambios y corregirlo mediante
una intervención administrativa explícita y autorizada, conservando su identidad
y todos los registros de negocio.

## Validación local reproducible

```powershell
npm.cmd run test:panel-access
node --test server/prisma/tests/lote-4.test.mjs server/prisma/tests/separation.test.mjs
npm.cmd run qa:panel-access-ui
npm.cmd run qa:separation-ui
npm.cmd run build:all
git diff --check
```

Las suites crean PostgreSQL desechable en Docker local y generan un Prisma
aislado. No leen archivos `.env` reales. Los dos builds se ejecutaron con
`envFile: false` mediante la API de Vite, sin variables de producción. Para
reproducir las capturas se requiere Edge y `playwright-core` en
`TECRUTA_QA_TOOLS` (igual que en la separación original). Se admiten también
`TECRUTA_QA_BROWSER` y `TECRUTA_QA_EVIDENCE` para las evidencias de regresión.

Resultados y capturas del acceso: [evidencia/resultados.json](evidencia/resultados.json).
Resumen: [validacion.json](validacion.json): 25 pruebas de API/autenticación
distintas, seis grupos UI de acceso y cinco de regresión, ambos builds correctos.
Capturas principales: [escritorio claro](evidencia/login-escritorio-light.png),
[tablet oscuro](evidencia/login-tablet-dark.png),
[Google en panel](evidencia/google-panel-autorizado.png),
[cliente rechazado](evidencia/google-cliente-rechazado.png),
[recuperación de cuenta Google](evidencia/recuperacion-cuenta-google.png).
Los perfiles Google y el correo fueron dobles de prueba locales; no se simuló
una autorización real ni se modificaron usuarios de negocio.

Advertencias de build heredadas: tamaño del visor 3D e importación mixta de
ubigeo. No se actualizaron versiones ni lockfiles en este alcance.
