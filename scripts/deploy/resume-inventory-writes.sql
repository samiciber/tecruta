-- Solo antes de migrar para abortar, o con TODAS las instancias nuevas activas.
-- Después de migrar, nunca reanudar con la API antigua sin Kardex.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
DROP TRIGGER tecruta_cutover_product_stock ON products;
DROP TRIGGER tecruta_cutover_product_rows ON products;
DROP TRIGGER tecruta_cutover_orders ON orders;
DROP TRIGGER tecruta_cutover_order_items ON order_items;
DROP FUNCTION tecruta_cutover_block_write();
COMMIT;
