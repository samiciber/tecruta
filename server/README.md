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