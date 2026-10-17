BEGIN;
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE';
ALTER TYPE "Role" ADD VALUE 'CASHIER';

LOCK TABLE "products" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "products" ADD COLUMN "sku" TEXT;
UPDATE "products"
SET "sku" = 'TR-' || upper(md5("id"))
WHERE "sku" IS NULL;
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

CREATE TYPE "ProductBarcodeKind" AS ENUM ('MANUFACTURER', 'INTERNAL');
CREATE TABLE "product_barcodes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "kind" "ProductBarcodeKind" NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_barcodes_normalizedCode_key" ON "product_barcodes"("normalizedCode");
CREATE INDEX "product_barcodes_productId_idx" ON "product_barcodes"("productId");
ALTER TABLE "product_barcodes"
    ADD CONSTRAINT "product_barcodes_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "InventoryMovementType" AS ENUM (
    'INITIAL_BALANCE',
    'PURCHASE',
    'CUSTOMER_RETURN',
    'POSITIVE_ADJUSTMENT',
    'LOSS',
    'DAMAGE',
    'SUPPLIER_RETURN',
    'NEGATIVE_ADJUSTMENT',
    'WEB_ORDER',
    'WEB_CANCELLATION',
    'REVERSAL'
);
CREATE TYPE "InventoryDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "InventoryMovementStatus" AS ENUM ('DRAFT', 'CONFIRMED');

CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "direction" "InventoryDirection" NOT NULL,
    "status" "InventoryMovementStatus" NOT NULL DEFAULT 'DRAFT',
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "supplier" TEXT,
    "unitCost" DECIMAL(10,2),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "confirmedById" TEXT,
    "sourceKey" TEXT,
    "reversalOfId" TEXT,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_quantity_check" CHECK (
        ("type" = 'INITIAL_BALANCE' AND "quantity" >= 0)
        OR ("type" <> 'INITIAL_BALANCE' AND "quantity" > 0)
    )
);
CREATE UNIQUE INDEX "inventory_movements_sourceKey_key" ON "inventory_movements"("sourceKey");
CREATE UNIQUE INDEX "inventory_movements_reversalOfId_key" ON "inventory_movements"("reversalOfId");
CREATE UNIQUE INDEX "inventory_movements_one_initial_balance_per_product_key"
    ON "inventory_movements"("productId") WHERE "type" = 'INITIAL_BALANCE';
CREATE INDEX "inventory_movements_productId_occurredAt_createdAt_idx"
    ON "inventory_movements"("productId", "occurredAt", "createdAt");
CREATE INDEX "inventory_movements_type_occurredAt_idx" ON "inventory_movements"("type", "occurredAt");
CREATE INDEX "inventory_movements_status_occurredAt_idx" ON "inventory_movements"("status", "occurredAt");
CREATE INDEX "inventory_movements_createdById_occurredAt_idx" ON "inventory_movements"("createdById", "occurredAt");
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_reversalOfId_fkey"
    FOREIGN KEY ("reversalOfId") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "inventory_movements" (
    "id", "productId", "type", "direction", "status", "quantity", "reason",
    "reference", "occurredAt", "createdAt", "confirmedAt", "sourceKey", "balanceAfter"
)
SELECT
    'opening-' || md5("id"),
    "id",
    'INITIAL_BALANCE',
    'IN',
    'CONFIRMED',
    "stock",
    'Saldo existente al habilitar el Kardex',
    'Migración de inventario 20261017000000',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'inventory-opening:' || "id",
    "stock"
FROM "products";

ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_balance_nonnegative
  CHECK ("balanceAfter" IS NULL OR "balanceAfter" >= 0);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_cost_nonnegative
  CHECK ("unitCost" IS NULL OR "unitCost" >= 0);

CREATE FUNCTION inventory_assign_sku() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
    NEW.sku := 'TR-' || upper(md5(NEW.id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_assign_sku BEFORE INSERT OR UPDATE OF sku ON products
  FOR EACH ROW EXECUTE FUNCTION inventory_assign_sku();

-- Namespace compartido: SKU y alias nunca identifican productos distintos.
CREATE FUNCTION inventory_unique_identifier() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identifier text;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    NEW.sku := upper(btrim(NEW.sku)); identifier := NEW.sku;
  ELSE
    NEW.code := btrim(NEW.code); NEW."normalizedCode" := upper(NEW.code);
    identifier := NEW."normalizedCode";
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tecruta:product-identifier:' || identifier, 0));
  IF (TG_TABLE_NAME = 'products' AND EXISTS (SELECT 1 FROM product_barcodes WHERE "normalizedCode" = identifier))
    OR (TG_TABLE_NAME = 'product_barcodes' AND EXISTS (SELECT 1 FROM products WHERE sku = identifier)) THEN
    RAISE EXCEPTION 'Identificador ya asignado' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_unique_identifier BEFORE INSERT OR UPDATE OF sku ON products
  FOR EACH ROW EXECUTE FUNCTION inventory_unique_identifier();
CREATE TRIGGER barcodes_unique_identifier BEFORE INSERT OR UPDATE ON product_barcodes
  FOR EACH ROW EXECUTE FUNCTION inventory_unique_identifier();
ALTER TABLE products ADD CONSTRAINT products_sku_format
  CHECK (sku ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$');
ALTER TABLE product_barcodes ADD CONSTRAINT product_barcodes_code_format
  CHECK (length(code) BETWEEN 1 AND 128 AND code !~ '[[:cntrl:]]'
    AND (kind <> 'INTERNAL' OR code ~ '^TR-[A-Za-z0-9._-]{1,36}$'));
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_confirmed_fields
  CHECK (status <> 'CONFIRMED' OR ("balanceAfter" IS NOT NULL AND "confirmedAt" IS NOT NULL));

CREATE FUNCTION inventory_preserve_confirmed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CONFIRMED' THEN
    RAISE EXCEPTION 'Los movimientos confirmados son inmutables; registre una reversion';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_preserve_confirmed BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION inventory_preserve_confirmed();

-- Diferido: producto y asiento se comprueban juntos al COMMIT.
CREATE FUNCTION inventory_check_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_id text; actual_stock integer; ledger_stock bigint;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN product_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN product_id := OLD."productId";
  ELSE product_id := NEW."productId"; END IF;
  SELECT stock INTO actual_stock FROM products WHERE id = product_id;
  SELECT coalesce(sum(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END), 0)
    INTO ledger_stock FROM inventory_movements
    WHERE "productId" = product_id AND status = 'CONFIRMED';
  IF actual_stock IS DISTINCT FROM ledger_stock THEN
    RAISE EXCEPTION 'Stock sin movimiento de inventario para el producto %', product_id;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER products_check_inventory AFTER INSERT OR UPDATE ON products
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_check_balance();
CREATE CONSTRAINT TRIGGER movements_check_inventory AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_check_balance();
COMMIT;
