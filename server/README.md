# TecRuta API

Express 4 + Prisma 5 + PostgreSQL (Node ESM). JWT (30 días), zod 4, bcryptjs, express-rate-limit. Integraciones: Resend (correo), Cloudinary (subidas firmadas), Google OAuth.

## Puesta en marcha (base local de desarrollo)

```bash
cp .env.example .env      # completa los valores reales (NUNCA subas .env)
npm install
npx prisma migrate dev
npm run seed:nav          # navegación (idempotente, no pisa ediciones)
npm run dev
```

Primer admin: registra la cuenta desde la web y ejecuta `npm run make-admin -- correo@ejemplo.com`.
`npm run seed` también re-sincroniza el catálogo estático y **sobrescribe productos editados**: úsalo solo en BD nueva.

## Autenticación segura (Lote 4)

- Registro, reenvío y recuperación responden siempre 202 con un mensaje genérico
  para correos nuevos, existentes o desconocidos. No devuelven `emailSent`.
  El envío se intenta en segundo plano; se puede reenviar después de 60 segundos.
- Códigos: CSPRNG de seis dígitos, hash HMAC por cuenta/propósito, vigencia de
  15 minutos y cinco fallos antes de bloquear ese propósito por 15 minutos.
  Reenviar no reinicia el contador. Solo se envían por correo, nunca por API.
- Google exige `sub` y `email_verified === true`. Solo vincula por correo una
  cuenta local ya verificada sin otra identidad de Google; conserva contraseña,
  nombre y rol. Una cuenta pendiente debe verificarse/recuperarse primero.
- La SPA inicia Google con una prueba por pestaña. OAuth usa state aleatorio de
  un uso, cookie HttpOnly/Secure en producción/SameSite=Lax (5 minutos) y PKCE.
  El callback devuelve `?code=`, no JWT; POST `/api/auth/google/exchange` canjea
  ese código y la prueba de la pestaña una sola vez, durante 60 segundos.
- La sesión sigue usando Bearer. La cookie anterior protege únicamente OAuth,
  no es una migración de las sesiones a cookies. La SPA usa sessionStorage si no
  se marca Recordar sesión, localStorage si se marca, y limpia el otro almacén.
- Cambiar/restablecer contraseña y POST `/api/auth/logout-all` incrementan
  `tokenVersion`, invalidando sesiones anteriores. Un JWT antiguo sin versión
  equivale a 0; se conserva hasta la primera revocación, incluso con campo NULL.
- Un fallo de base/red sigue siendo 5xx: no se convierte en 401 ni borra la
  sesión del navegador. Las páginas de cuenta/admin ofrecen reintentar.

Requiere la migración del Lote 2 presente. Genera el cliente actualizado con una
URL local de desarrollo y, desde la raíz, ejecuta:

```bash
node --test tests/lote-4.test.js
node --test server/prisma/tests/lote-4.test.mjs
npm run build
```

La integración usa su propio PostgreSQL desechable y Google/correo sustituidos;
nunca conecta a la base de `.env`. Despliegue, efectos sobre códigos anteriores
y propuesta futura de cookies de sesión: [Lote 4](../docs/lotes/lote-4.md).

## Endpoints públicos

| Ruta | Descripción |
|---|---|
| `GET /api/health` | Estado |
| `GET /api/categories` | Solo categorías **heredadas** (compatibilidad) |
| `GET /api/categories/tree` | Árbol visible (sin heredadas) |
| `GET /api/categories/:slug` | Nodo + migas + hijos + tiles |
| `GET /api/products` | `?category=` (incluye subcategorías) `?brand=` `?q=` `?featured=true` |
| `GET /api/products/:slug` | Detalle |
| `GET /api/nav` | Menús Acuerdos/Soporte/Descubre/Más/quick + promo |
| `GET /api/brands` | `{ featured, all }` con `productCount` |
| `GET /api/popular-searches` · `/api/stores` · `/api/site-settings` | Contenido editable (banners: solo activos) |
| `GET /api/payment-methods` | Métodos de pago |

Los endpoints de contenido llevan `Cache-Control: public, max-age=30`.

## Con sesión

`/api/auth/*` (registro, verificación, login, recuperación, Google) · `POST /api/orders` (sesión opcional), `GET /api/orders/me` · `/api/cart/*` · `/api/addresses/*` · **`/api/saved/*`** (elementos guardados: `GET /`, `POST /items`, `DELETE /items/:productId`, `POST /merge`).

## Administración (`requireAuth` + rol `ADMIN`)

- Legado: productos, categorías, métodos de pago, pedidos, usuarios, subidas.
- Nuevo (todo con zod; slugs duplicados → **409**): `brands`, `popular-searches`, `stores` (una sola predeterminada), `site-settings/:key` (`seasonalPromo`, `homeBanners`, `cartFooterLinks`), `nav-items` (+ `PUT /nav-items/reorder`), `category-tree` (+ tiles), `POST /products/assign` (asignación masiva), `GET /dashboard`.

## Pedidos y comprobantes (Lote 3)

- `POST /api/orders` requiere `Idempotency-Key` (UUID v4). Reintenta con la
  **misma clave, cuerpo y cuenta**: devuelve el mismo pedido sin volver a
  descontar stock. Cambiar el cuerpo/cuenta con esa clave devuelve 409.
- Los productos repetidos se agrupan. Precios y stock se resuelven en una
  transacción; un cambio de stock/precio devuelve 409 con `productId` y revierte
  el pedido entero. El total es el subtotal; el ahorro es informativo.
- El POST de creación de invitado devuelve un `receiptToken`, también al
  recuperar ese mismo intento tras una respuesta perdida. Solo su hash se
  almacena en la base. Nunca se devuelve en listados ni se coloca en URLs.
- `POST /api/orders/:orderId/receipt` exige Bearer del propietario/ADMIN o
  `X-Receipt-Token` del pedido de invitado. Responde `{ ok, receiptUrl }`.
  Pedidos antiguos de invitado sin hash requieren intervención de ADMIN.
- JSON general: 100 KB. Solo POSTs de subida autorizados admiten más: imágenes
  7 MiB de JSON / 5 MiB decodificados; comprobantes 12 / 8 MiB; modelos 21 / 15
  MiB. Imágenes: JPEG, PNG, GIF o WebP; comprobantes también PDF. Se comprueban
  base64, tamaño real y firmas; SVG y MIME que no coincida se rechazan.
- Límite por IP y proceso: 20 intentos de pedido y 30 de comprobante cada 15
  minutos. `TRUST_PROXY` admite 0–5 saltos; por defecto 1 para Render. Ajusta
  según el despliegue real; nunca `true`.
- Estados y selector admin comparten `src/utils/orderStatus.js`. CANCELLED y
  DELIVERED son terminales. Repetir un estado no duplica historial; cancelar
  devuelve stock una sola vez con bloqueo/transacción.

Requiere fusionar primero el Lote 2 para completar el historial. Desde la raíz:

```bash
node --test tests/lote-3.test.js
node --test server/prisma/tests/lote-3.test.mjs
npm run build
```

La suite de integración crea/elimina su propio PostgreSQL, usa cuentas y pedidos
ficticios y reemplaza Cloudinary; nunca usa la base configurada en `.env`.
Detalles de contratos, pruebas, despliegue coordinado y reversión:
[docs/lotes/lote-3.md](../docs/lotes/lote-3.md).

## Notas de diseño

- `Product.brand` (texto) se conserva; `brandId` es la marca normalizada (`brandSlug` en la respuesta).
- Productos, categorías y métodos de pago admin **legados** validan sus entradas con zod; duplicados → 409, registros inexistentes → 404. La marca del producto se resuelve contra marcas existentes y se guarda junto con su relación. Ver [Lote 6](../docs/lotes/lote-6.md).
- Seguridad: validar siempre con zod, no confiar en precios del cliente (el pedido recalcula en servidor).

## Historial de migraciones

- `20260924000001_add_google_oauth` agrega `users.googleId` y su índice único.
- `20260924000002_add_order_receipt_url` agrega `orders.receiptUrl`.
- **`20260925071715_add_google_and_receipt` tiene un nombre histórico impreciso:**
  solo agrega `products.enable3D`, `hotspots`, `model3DPoster` y `model3DUrl`.
  Se conserva su carpeta y SQL porque ya fue aplicada; no se renombra.
- `20261012000000_add_nav_brands_stores_saved_items` completa navegación,
  marcas, tiendas, ajustes y guardados. Marca como `legacy` las ocho categorías
  originales sin eliminar categorías ni reasignar productos. No ejecuta seeds.

Prueba reproducible, desde la raíz del repositorio, con Docker y las dependencias
del servidor instaladas:

```bash
node --test server/prisma/tests/lote-2.test.mjs
```

La prueba crea y elimina su propio PostgreSQL desechable; sobrescribe
`DATABASE_URL` únicamente en los procesos de prueba con una URL local generada.
No usa la base definida en `.env`.

Para producción sigue [el procedimiento del Lote 2](../docs/lotes/lote-2.md#producción-pasos-para-el-operador).
`migrate status` compara el historial, no demuestra que este reproduzca todo el
esquema. Si Neon ya tiene los objetos de navegación, no ejecutes esta nueva
migración sobre ellos: primero verifica estructura **y datos `legacy`**, y usa
`migrate resolve --applied` solo si ambos coinciden. Nunca `db push`,
`migrate reset` ni `migrate dev` en producción.
