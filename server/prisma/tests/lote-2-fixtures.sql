-- Synthetic data for the five-migration state. Disposable PostgreSQL only.
INSERT INTO "categories" ("id", "slug", "name", "description", "icon")
SELECT 'qa-category-' || slug, slug, 'QA ' || slug, 'Preserve description', 'battery'
FROM unnest(ARRAY[
    'power-banks', 'cargadores', 'cables', 'audifonos',
    'accesorios', 'celulares', 'tablets', 'laptops', 'qa-other-category'
]) AS slug;

INSERT INTO "users" ("id", "email", "passwordHash", "nombre", "apellido", "updatedAt", "googleId")
VALUES ('qa-user', 'qa@example.invalid', 'not-a-real-hash', 'QA', 'Example', '2026-01-01', 'qa-google');
INSERT INTO "addresses" ("id", "userId", "departamento", "provincia", "distrito", "direccion")
VALUES ('qa-address', 'qa-user', 'QA', 'QA', 'QA', 'Fictitious address');
INSERT INTO "products" (
    "id", "slug", "name", "brand", "price", "compareAtPrice", "stock", "tags",
    "categoryId", "updatedAt", "enable3D", "hotspots", "model3DUrl", "model3DPoster"
) VALUES (
    'qa-product', 'qa-product', 'QA product', 'UGREEN', 49.90, 59.90, 7, ARRAY['qa'],
    'qa-category-power-banks', '2026-01-01', true, '[{"id":"qa"}]', '/qa.glb', '/qa.webp'
);
INSERT INTO "product_images" ("id", "url", "productId")
VALUES ('qa-image', '/qa.webp', 'qa-product');
INSERT INTO "payment_methods" ("id", "key", "label", "config")
VALUES ('qa-payment', 'qa-payment', 'QA payment', '{"qa":true}');
INSERT INTO "carts" ("id", "userId", "updatedAt")
VALUES ('qa-cart', 'qa-user', '2026-01-01');
INSERT INTO "cart_items" ("id", "cartId", "productId", "quantity")
VALUES ('qa-cart-item', 'qa-cart', 'qa-product', 2);
INSERT INTO "orders" (
    "id", "userId", "customerNombre", "customerApellido", "customerCorreo", "customerCelular",
    "deliveryType", "departamento", "provincia", "distrito", "paymentMethodId",
    "subtotal", "savings", "total", "updatedAt", "receiptUrl"
) VALUES (
    'qa-order', 'qa-user', 'QA', 'Example', 'qa@example.invalid', '000000000',
    'SHIPPING', 'QA', 'QA', 'QA', 'qa-payment', 99.80, 20, 99.80, '2026-01-01', '/qa-receipt.pdf'
);
INSERT INTO "order_items" ("id", "orderId", "productId", "name", "quantity", "unitPrice")
VALUES ('qa-order-item', 'qa-order', 'qa-product', 'QA product', 2, 49.90);
INSERT INTO "order_status_history" ("id", "orderId", "status", "note")
VALUES ('qa-history', 'qa-order', 'PENDING', 'Preserve history');
