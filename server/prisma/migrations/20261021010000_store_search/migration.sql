BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION store_normalize_search(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(value,'')), 'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    U&'[\0300-\036f]', '', 'g'), '\s+', ' ', 'g'));
$$;
ALTER TABLE products ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE brands ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
CREATE FUNCTION store_product_search_value() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchText" := store_normalize_search(concat_ws(' ', NEW.name, NEW.sku,
    coalesce((SELECT name FROM brands WHERE id=NEW."brandId"),NEW.brand),
    (SELECT name FROM categories WHERE id=NEW."categoryId"), array_to_string(NEW.tags,' ')));
  RETURN NEW;
END;
$$;
CREATE TRIGGER store_product_search BEFORE INSERT OR UPDATE OF name,sku,brand,"brandId","categoryId",tags ON products
FOR EACH ROW EXECUTE FUNCTION store_product_search_value();
CREATE FUNCTION store_entity_search_value() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchText" := store_normalize_search(NEW.name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER store_brand_search BEFORE INSERT OR UPDATE OF name ON brands FOR EACH ROW EXECUTE FUNCTION store_entity_search_value();
CREATE TRIGGER store_category_search BEFORE INSERT OR UPDATE OF name ON categories FOR EACH ROW EXECUTE FUNCTION store_entity_search_value();
CREATE FUNCTION store_refresh_related_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'brands' THEN
    UPDATE products p SET "searchText"=store_normalize_search(concat_ws(' ',p.name,p.sku,NEW.name,
      (SELECT name FROM categories WHERE id=p."categoryId"),array_to_string(p.tags,' '))) WHERE p."brandId"=NEW.id;
  ELSE
    UPDATE products p SET "searchText"=store_normalize_search(concat_ws(' ',p.name,p.sku,
      coalesce((SELECT name FROM brands WHERE id=p."brandId"),p.brand),NEW.name,array_to_string(p.tags,' '))) WHERE p."categoryId"=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER store_brand_search_refresh AFTER UPDATE OF name ON brands FOR EACH ROW EXECUTE FUNCTION store_refresh_related_search();
CREATE TRIGGER store_category_search_refresh AFTER UPDATE OF name ON categories FOR EACH ROW EXECUTE FUNCTION store_refresh_related_search();
UPDATE brands SET "searchText"=store_normalize_search(name);
UPDATE categories SET "searchText"=store_normalize_search(name);
UPDATE products p SET "searchText"=store_normalize_search(concat_ws(' ',p.name,p.sku,
  coalesce((SELECT name FROM brands WHERE id=p."brandId"),p.brand),
  (SELECT name FROM categories WHERE id=p."categoryId"),array_to_string(p.tags,' ')));
-- pg_trgm already exists in the applied POS migration; no new extension.
-- Flush deferred stock-integrity checks raised by the backfill before DDL.
-- This validates existing balances and does not disable any constraint.
SET CONSTRAINTS ALL IMMEDIATE;
CREATE INDEX products_store_search_idx ON products USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX brands_store_search_idx ON brands USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX categories_store_search_idx ON categories USING GIN ("searchText" gin_trgm_ops);
COMMIT;
