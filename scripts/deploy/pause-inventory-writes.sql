-- Solo durante la ventana operativa autorizada. No ejecutar como migración.
-- El catálogo y las consultas siguen disponibles; escrituras reciben error.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
LOCK TABLE products, orders, order_items IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION tecruta_cutover_block_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Actualización de inventario en curso; reintente más tarde'
    USING ERRCODE = '55000';
END $$;
CREATE TRIGGER tecruta_cutover_product_stock BEFORE UPDATE OF stock ON products
  FOR EACH STATEMENT EXECUTE FUNCTION tecruta_cutover_block_write();
CREATE TRIGGER tecruta_cutover_product_rows BEFORE INSERT OR DELETE OR TRUNCATE ON products
  FOR EACH STATEMENT EXECUTE FUNCTION tecruta_cutover_block_write();
CREATE TRIGGER tecruta_cutover_orders BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON orders
  FOR EACH STATEMENT EXECUTE FUNCTION tecruta_cutover_block_write();
CREATE TRIGGER tecruta_cutover_order_items BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON order_items
  FOR EACH STATEMENT EXECUTE FUNCTION tecruta_cutover_block_write();
COMMIT;
