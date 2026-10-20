# Archivos y alcance de la entrega

Base: `7d14d11`; rama local `feature/rediseno-tienda-resenas`. No se han enviado estos commits a GitHub.

## Código y documentación principal

| Estado Git | Archivo |
|---|---|
| A | `docs/tienda-resenas/README.md` |
| A | `docs/tienda-resenas/bundle-base.json` |
| M | `package.json` |
| A | `scripts/preview-store-reviews.mjs` |
| M | `scripts/verify-pos-recovery-ui.mjs` |
| A | `server/prisma/migrations/20261020000000_product_reviews/migration.sql` |
| M | `server/prisma/schema.prisma` |
| A | `server/prisma/tests/product-reviews.test.mjs` |
| A | `server/scripts/review-invitations.mjs` |
| M | `server/src/index.js` |
| M | `server/src/lib/homeResolver.js` |
| M | `server/src/lib/homeSchemas.js` |
| M | `server/src/lib/mailer.js` |
| M | `server/src/lib/navSchemas.js` |
| A | `server/src/lib/reviewInvitations.js` |
| A | `server/src/lib/reviewSchemas.js` |
| A | `server/src/lib/reviewService.js` |
| M | `server/src/lib/serializers.js` |
| A | `server/src/lib/storeBusinessSchema.js` |
| A | `server/src/routes/reviews.routes.js` |
| A | `server/tests/store-reviews.test.mjs` |
| M | `src/app/PanelRoot.jsx` |
| M | `src/app/StoreRoot.jsx` |
| M | `src/app/panelNavigation.js` |
| A | `src/components/home/CustomerReviews.jsx` |
| M | `src/components/home/HeroSlide.jsx` |
| M | `src/components/home/HeroSlider.jsx` |
| M | `src/components/home/HomeContentSections.jsx` |
| M | `src/components/home/HomeView.jsx` |
| M | `src/components/home/ProductCarousel.jsx` |
| D | `src/components/home/Testimonials.jsx` |
| M | `src/components/layout/FooterContent.jsx` |
| M | `src/components/layout/Header.jsx` |
| A | `src/components/layout/ShopInformation.jsx` |
| M | `src/components/layout/header/HeaderSearch.jsx` |
| M | `src/components/product/ProductCard.jsx` |
| A | `src/components/product/ProductReviews.jsx` |
| A | `src/components/product/Rating.jsx` |
| A | `src/components/product/ReviewCard.jsx` |
| D | `src/data/testimonials.js` |
| M | `src/pages/Login.jsx` |
| M | `src/pages/ProductDetail.jsx` |
| A | `src/pages/admin/AdminBusiness.jsx` |
| M | `src/pages/admin/AdminHomeLayout.jsx` |
| A | `src/pages/admin/AdminReviews.jsx` |
| M | `src/pages/panel/PanelLogin.jsx` |
| M | `src/services/api.js` |
| M | `src/services/sessionStorage.js` |
| M | `src/storefront.css` |
| M | `src/utils/imageUrl.js` |
| A | `src/utils/reviewJsonLd.js` |

Los documentos nuevos de esta entrega están en `docs/tienda-resenas/`: README, publicación/recuperación, validación, este inventario y capturas. Los archivos eliminados son únicamente el componente y los datos de testimonios ficticios.

## Evidencias

21 capturas JPEG en `capturas/`; informes de audit, builds, sintaxis, comparación de fallos y logs completos en `validacion/`.

La batería nueva tiene 18 pruebas correctas; la completa mantiene 57 fallos existentes también en la base. Esto es una entrega para revisión local con limitaciones documentadas.

## Sin cambios

No se modificaron `server/src/routes/auth.routes.js`, `orders.routes.js`, `pos.routes.js`, `orderService.js`, `posService.js`, `inventoryService.js`, los lockfiles ni las migraciones anteriores. La excepción de sesión está limitada al helper frontend y al texto de los formularios para evitar tokens en localStorage. La moderación y los datos comerciales son las únicas pantallas nuevas de panel.
