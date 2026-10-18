# Separación de tienda y administración, sin cambio de base

> Este documento conserva la entrega base `fae9594`. La corrección posterior de
> Google en panel y del alias ADMIN, con su única migración aditiva, se describe
> en [Acceso al panel](../acceso-panel/README.md). Esa corrección está preparada
> para revisión local y no está publicada.

Esta entrega parte de `main` (`97684b3`). Conserva exactamente el esquema Prisma,
los SQL de migraciones, versiones y lockfiles de esa revisión. No incluye
inventario, Kardex, POS, caja, invitaciones de personal ni nuevos roles. El trabajo
integrado continúa en `implementacion/panel-separado` (`c9116c0`), sin incorporarlo
a esta publicación. No debe desplegarse esa rama sobre la base actual.

## Aplicaciones y acceso

- Tienda: `https://www.tecruta.com`, build `npm run build:store`, salida `dist`.
- Panel provisional: `https://tecruta-panel.vercel.app`, build
  `npm run build:panel`, salida `dist-panel`. Ruta `/iniciar-sesion`.
- API compartida: `https://tecruta.onrender.com`. La base actual permanece en Neon.
- `admin.tecruta.com`: conexión pendiente de acceso al administrador DNS.

El panel reutiliza `/api/auth/login`, `/api/auth/me` y las cuentas existentes.
Solo ADMIN entra; cada endpoint administrativo conserva la comprobación ADMIN
del servidor. Un cliente recibe acceso denegado. No hay registro público en el
panel, creación de cuentas ficticias, sesiones en URL ni cambios de contraseñas.
La sesión se guarda por origen: al entrar por primera vez en el nuevo panel,
inicia sesión otra vez con tu cuenta administrativa existente.

Productos, pedidos, clientes, categorías, marcas, contenido del Home y ajustes
conservan sus funciones actuales. La tienda y el panel comparten datos reales
mediante la API. La tienda redirige sus rutas antiguas `/admin/*` al panel.
El panel admite esas rutas antiguas y conserva destino, consulta y fragmento.
Los bundles de tienda no incluyen páginas administrativas. El panel no monta
la navegación de compras y su previsualización del Home no permite compras.

## Configuración de publicación

Ambos proyectos Vercel: repositorio actual, raíz `./`, Vite, instalación `npm ci`.
Configurar el build y salida de cada proyecto según lo indicado arriba. Variables
públicas en ambos (no incluir secretos del servidor):

```dotenv
VITE_API_URL=https://tecruta.onrender.com
VITE_STORE_ORIGIN=https://www.tecruta.com
VITE_PANEL_ORIGIN=https://tecruta-panel.vercel.app
```

Render mantiene `server`, build `npm ci && npx prisma generate`, inicio `npm start`.
Añadir únicamente los orígenes exactos:

```dotenv
CORS_ORIGINS=https://www.tecruta.com,https://tecruta-panel.vercel.app
STORE_ORIGIN=https://www.tecruta.com
```

`CORS_ORIGIN` sigue admitido como configuración anterior cuando no se define
`CORS_ORIGINS`. Si hay otros orígenes legítimos ya habilitados, conservarlos de
forma explícita. No permitir `*.vercel.app`, `*`, previews arbitrarias ni URLs con
rutas. CORS no reemplaza la autorización del servidor. Las solicitudes sin Origin
siguen permitidas para verificaciones de salud y clientes del servidor, con los
mismos permisos de API. Google sigue regresando a la tienda pública.

Orden: publicar panel, guardar lista CORS exacta y desplegar API compatible,
comprobar login/API, publicar tienda. Mantener el despliegue anterior disponible
para rollback. No usar modo mantenimiento, no cambiar DNS ni secretos, no ejecutar
`prisma migrate`, seed, `make-admin` ni SQL de inventario/POS. Generar Prisma durante
el build no ejecuta migraciones.

## Validación y revisión

```powershell
npm ci
npm --prefix server ci
npm run build:all
npm run test:separation
npm run qa:separation-ui
git diff --check
```

Las pruebas de integración/UI arrancan PostgreSQL desechable en Docker local,
aplican únicamente las migraciones de `main` a esa base vacía, interceptan salidas
externas y usan cuentas sintéticas `@example.test`. No leen `.env` reales. La UI
requiere `playwright-core` y Edge instalados; el script admite `TECRUTA_QA_TOOLS`
(directorio node_modules) y `TECRUTA_QA_BROWSER` (ejecutable). No se añaden
dependencias a la aplicación por estas pruebas.

Resultado: ambos builds, 67 pruebas de regresión, dos pruebas específicas y cinco
grupos de comprobaciones UI pasan. Evidencias en `evidencia/`: login, escritorio y
tablet claros/oscuros, tienda y checkout. Se probó rechazo de clientes, permisos
de API, CORS de ambos orígenes y rechazo de terceros, persistencia de ajustes,
recarga de rutas, carrito, checkout y recuperación de sesión tras fallo de red.

Advertencias ya existentes: bundle grande del visor 3D, importación mixta de
ubigeo y cinco avisos altos de auditoría en dependencias frontend fijadas. No se
aplicaron actualizaciones automáticas ajenas a este alcance.

## Recuperación y DNS pendiente

Ante un fallo, restaurar el despliegue previo de tienda y API (`97684b3`), conservar
la base y todas sus escrituras posteriores. No restaurar un dump sobre ventas o
pedidos nuevos: esta separación no altera el esquema ni requiere recuperar datos.
La API anterior usa `CORS_ORIGIN`; conservar esa variable y sus secretos permite
retroceder sin cambiar configuración de cuentas.

Cuando esté disponible DNS: añadir `admin.tecruta.com` al proyecto del panel,
obtener el CNAME indicado por Vercel y configurarlo en el DNS autoritativo. Una vez
validado HTTPS, añadir solo ese origen a CORS, cambiar `VITE_PANEL_ORIGIN` en ambos
proyectos, actualizar la cabecera noindex del host en `vercel.json` y reconstruir.
Mantener la URL provisional hasta comprobar el cambio. No mover datos ni crear
otra base. Los nameservers observados pertenecen a Porkbun; eso identifica al
proveedor DNS, no a la persona ni a la cuenta que tiene acceso.
