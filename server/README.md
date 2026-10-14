# TecRuta API

Express 4 + Prisma 5 + PostgreSQL (Node ESM). JWT (30 días), zod 4, bcryptjs, express-rate-limit. Integraciones: Resend (correo), Cloudinary (subidas firmadas), Google OAuth.

## Puesta en marcha

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

## Notas de diseño

- `Product.brand` (texto) se conserva; `brandId` es la marca normalizada (`brandSlug` en la respuesta).
- Los endpoints admin **legados** aún no usan zod y devuelven 500 en slugs duplicados: pendiente de endurecer.
- Seguridad: validar siempre con zod, no confiar en precios del cliente (el pedido recalcula en servidor).