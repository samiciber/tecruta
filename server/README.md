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
