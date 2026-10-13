# TecRuta — Tienda online

Tienda de tecnología para Perú. **Frontend** React 18 + Vite 5 + Tailwind 3 (`src/`, se despliega en Vercel) y **backend** Node + Express + Prisma + PostgreSQL (`server/`). El diseño sigue la estructura de una tienda tipo bestbuy.com (header de dos filas, menú multinivel, marcas, cuenta, carrito) con la identidad de TecRuta.

## Arquitectura

```text
src/
├── components/
│   ├── layout/        Header (2 filas), MobileMenu, AccountMenu, header/* (paneles, buscador, tienda)
│   ├── catalog/       ProductBrowser (filtros/orden/paginación de categoría y marca)
│   ├── cart/ product/ filters/ home/ account/ admin/ ui/
├── pages/             Home, Catalog, CategoryPage, BrandPage, Brands, Cart, ProductDetail, Checkout,
│                      account/* (Pagos, Mi tarjeta, Planes, Guardados), admin/* (panel)
├── context/           Auth, Cart, Saved (elementos guardados), Theme
├── hooks/             useCachedResource (caché con revalidación), useSiteContent, useCategories, usePanel…
├── data/navSeed.js    ÚNICA fuente de la taxonomía (la usan el seed del servidor y el respaldo del frontend)
└── services/api.js    Cliente de la API (VITE_API_URL, por defecto http://localhost:4000)
```

**Contenido editable desde el admin** (con respaldo mínimo si la API falla): categorías en árbol (visibilidad, orden, imagen, tiles), marcas, menús Acuerdos / Soporte / Descubre / Más y enlaces rápidos, búsquedas populares, tiendas, promo de temporada, banners del Home y enlaces del pie del carrito. `useCachedResource` comprueba su TTL al montar, volver a la pestaña o invalidar; no promete actualización automática de todo el contenido en menos de 60 s.

**Catálogo y pagos:** recursos compartidos con TTL activo de 60 s en pestañas visibles, actualización al recuperar foco/visibilidad y después de mutaciones relacionadas. El respaldo de productos permite consultar; para agregar al carrito o crear un pedido se exige información vigente de la API. No se muestran datos de transferencia estáticos si los pagos no se pueden verificar. Ver [Lote 7](docs/lotes/lote-7.md).

**Categorías heredadas:** las 8 originales (power-banks, cargadores…) quedan marcadas `legacy`: no aparecen en menús, filtros ni Home, pero siguen en la BD y en el admin hasta reasignar sus productos (Admin → Asignar productos).

## Desarrollo

```bash
npm install && npm run dev            # frontend → http://localhost:5173
cd server && npm install && npm run dev   # API → http://localhost:4000
```

Variables: ver `.env.example` (raíz, solo `VITE_API_URL`) y `server/.env.example`. **Nunca subas `.env`**.

## Base de datos

```bash
cd server
npx prisma migrate dev     # desarrollo
npx prisma migrate deploy  # producción
npm run seed:nav           # navegación: categorías, marcas, menús, búsquedas (idempotente, NO pisa ediciones)
```

> `npm run seed` además re-sincroniza el catálogo estático y **sobrescribe productos editados**: úsalo solo en una BD nueva.
> Primer administrador: regístrate en `/crear-cuenta`, verifica el correo y ejecuta `npm run make-admin -- tu@correo.com`.

## Checklist de salida a producción

**Seguridad**
- [ ] Rotar TODAS las claves que alguna vez estuvieron en `server/.env.example` o en un zip (Resend, Google OAuth, Cloudinary, JWT_SECRET) y revisar el historial de git.
- [ ] `JWT_SECRET` largo y aleatorio; `CORS_ORIGIN` = URL real del frontend; `GOOGLE_CALLBACK_URL` registrada en Google Cloud.
- [ ] `.env` fuera del repo y de cualquier zip compartido.

**Base de datos y despliegue**
- [ ] Respaldo (`pg_dump`) antes de migrar; `prisma migrate deploy`; luego `npm run seed:nav`.
- [ ] Variable `VITE_API_URL` en Vercel apuntando a la API pública.
- [ ] `GET /api/health` responde; `GET /api/nav`, `/api/brands`, `/api/categories/tree` devuelven datos.

**Contenido** (Admin)
- [ ] Revisar/ajustar el árbol de categorías y marcas (la taxonomía fuera de «Salud…» es un **borrador**).
- [ ] Asignar productos a categoría y marca (Asignar productos); subir logos, tiles y banners.
- [ ] Crear al menos una tienda (si no, se muestra «Tienda online»); revisar destinos «Próximamente».
- [ ] Verificar número de WhatsApp en `src/config/storeConfig.js`.

**QA rápido**
- [ ] Compra de prueba completa (invitado y con sesión); fusión de carrito y guardados al iniciar sesión.
- [ ] Menú con teclado (Tab, Esc, foco atrapado), modo oscuro, móvil.
- [ ] `npm run build` sin errores.
