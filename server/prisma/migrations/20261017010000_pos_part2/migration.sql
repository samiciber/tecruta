BEGIN;
-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'RETURNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PosPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'POS_SALE';
ALTER TYPE "InventoryMovementType" ADD VALUE 'POS_RETURN';

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingAmount" DECIMAL(12,2) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "countedAmount" DECIMAL(12,2),
    "expectedAmount" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "closingNote" TEXT,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_entries" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sales" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT,
    "customerDocument" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "discountReason" TEXT,
    "approvedById" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pos_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "received" DECIMAL(12,2) NOT NULL,
    "change" DECIMAL(12,2) NOT NULL,
    "status" "PosPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "confirmedById" TEXT,
    "sessionId" TEXT,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_refunds" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_refund_items" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restock" BOOLEAN NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pos_refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_operations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_sessions_userId_openedAt_idx" ON "cash_sessions"("userId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cash_entries_sourceKey_key" ON "cash_entries"("sourceKey");

-- CreateIndex
CREATE INDEX "cash_entries_sessionId_createdAt_idx" ON "cash_entries"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sales_orderId_key" ON "pos_sales"("orderId");

-- CreateIndex
CREATE INDEX "pos_sales_confirmedAt_userId_idx" ON "pos_sales"("confirmedAt", "userId");

-- CreateIndex
CREATE INDEX "pos_sales_userId_createdAt_idx" ON "pos_sales"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "pos_sale_items_productId_idx" ON "pos_sale_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sale_items_saleId_productId_key" ON "pos_sale_items"("saleId", "productId");

-- CreateIndex
CREATE INDEX "pos_payments_method_confirmedAt_idx" ON "pos_payments"("method", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pos_payments_saleId_method_key" ON "pos_payments"("saleId", "method");

-- CreateIndex
CREATE INDEX "pos_refunds_createdAt_userId_idx" ON "pos_refunds"("createdAt", "userId");

-- CreateIndex
CREATE INDEX "pos_refund_items_saleItemId_idx" ON "pos_refund_items"("saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_refund_items_refundId_saleItemId_key" ON "pos_refund_items"("refundId", "saleItemId");

-- CreateIndex
CREATE INDEX "pos_operations_userId_createdAt_idx" ON "pos_operations"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_refunds" ADD CONSTRAINT "pos_refunds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_refund_items" ADD CONSTRAINT "pos_refund_items_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "pos_refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_refund_items" ADD CONSTRAINT "pos_refund_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "pos_sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_operations" ADD CONSTRAINT "pos_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Búsquedas acotadas, sin descargar el catálogo completo.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_pos_name_search_idx ON products USING GIN (name gin_trgm_ops);
CREATE INDEX products_pos_sku_search_idx ON products USING GIN (sku gin_trgm_ops);
CREATE INDEX barcodes_pos_search_idx ON product_barcodes USING GIN ("normalizedCode" gin_trgm_ops);
CREATE UNIQUE INDEX cash_sessions_one_open_per_user ON cash_sessions("userId") WHERE status = 'OPEN';
ALTER TABLE cash_sessions ADD CONSTRAINT cash_amounts_valid CHECK ("openingAmount" >= 0 AND ("countedAmount" IS NULL OR "countedAmount" >= 0));
ALTER TABLE cash_entries ADD CONSTRAINT cash_entries_valid CHECK (amount <> 0 AND kind IN ('MANUAL_IN','MANUAL_OUT','SALE_PAYMENT','REFUND'));
ALTER TABLE pos_sales ADD CONSTRAINT pos_sale_amounts CHECK (subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND total = subtotal-discount AND (discount = 0 OR ("approvedById" IS NOT NULL AND "discountReason" IS NOT NULL)));
ALTER TABLE pos_sales ADD CONSTRAINT pos_sale_confirmation_state CHECK ((status IN ('CONFIRMED','RETURNED','VOIDED')) = ("confirmedAt" IS NOT NULL));
ALTER TABLE pos_sale_items ADD CONSTRAINT pos_item_amounts CHECK (quantity > 0 AND "unitPrice" >= 0 AND "lineTotal" >= 0);
ALTER TABLE pos_payments ADD CONSTRAINT pos_payment_amounts CHECK (amount > 0 AND received >= amount AND change = received-amount AND (status <> 'CONFIRMED' OR ("confirmedById" IS NOT NULL AND "sessionId" IS NOT NULL AND "confirmedAt" IS NOT NULL)));
ALTER TABLE pos_refunds ADD CONSTRAINT pos_refund_valid CHECK (amount >= 0 AND kind IN ('RETURN','VOID'));
ALTER TABLE pos_refund_items ADD CONSTRAINT pos_refund_item_valid CHECK (quantity > 0 AND amount >= 0);

CREATE FUNCTION pos_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro POS inmutable: registre una operación compensatoria';
END $$;
CREATE TRIGGER cash_entries_immutable BEFORE UPDATE OR DELETE ON cash_entries FOR EACH ROW EXECUTE FUNCTION pos_immutable();
CREATE TRIGGER pos_refunds_immutable BEFORE UPDATE OR DELETE ON pos_refunds FOR EACH ROW EXECUTE FUNCTION pos_immutable();
CREATE TRIGGER pos_refund_items_immutable BEFORE UPDATE OR DELETE ON pos_refund_items FOR EACH ROW EXECUTE FUNCTION pos_immutable();
CREATE TRIGGER pos_sale_items_immutable BEFORE UPDATE OR DELETE ON pos_sale_items FOR EACH ROW EXECUTE FUNCTION pos_immutable();
CREATE TRIGGER pos_operations_immutable BEFORE UPDATE OR DELETE ON pos_operations FOR EACH ROW EXECUTE FUNCTION pos_immutable();

CREATE FUNCTION pos_guard_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected numeric;
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'CLOSED' THEN RAISE EXCEPTION 'La caja cerrada no puede reabrirse ni modificarse'; END IF;
  IF NEW.status <> 'CLOSED' OR NEW."userId" <> OLD."userId" OR NEW."openingAmount" <> OLD."openingAmount" OR NEW."openedAt" <> OLD."openedAt" THEN
    RAISE EXCEPTION 'Sólo se permite cerrar el turno abierto';
  END IF;
  SELECT OLD."openingAmount" + coalesce(sum(amount),0) INTO expected FROM cash_entries WHERE "sessionId" = OLD.id;
  IF NEW."expectedAmount" IS DISTINCT FROM expected OR NEW."difference" IS DISTINCT FROM (NEW."countedAmount"-expected)
    OR NEW."countedAmount" IS NULL OR NEW."closedAt" IS NULL OR NEW."closingNote" IS NULL THEN RAISE EXCEPTION 'Cierre de caja inconsistente'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cash_session_guard BEFORE UPDATE OR DELETE ON cash_sessions FOR EACH ROW EXECUTE FUNCTION pos_guard_session();

CREATE FUNCTION pos_cash_requires_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text; session_status "CashSessionStatus";
BEGIN
  SELECT "userId",status INTO owner_id,session_status FROM cash_sessions WHERE id = NEW."sessionId" FOR UPDATE;
  IF session_status IS DISTINCT FROM 'OPEN' OR owner_id <> NEW."userId" THEN RAISE EXCEPTION 'La operación requiere la caja abierta de su responsable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cash_entry_requires_open BEFORE INSERT ON cash_entries FOR EACH ROW EXECUTE FUNCTION pos_cash_requires_open();
CREATE TRIGGER refund_requires_open BEFORE INSERT ON pos_refunds FOR EACH ROW EXECUTE FUNCTION pos_cash_requires_open();

CREATE FUNCTION pos_guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_status "CashSessionStatus";
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.status = 'CONFIRMED' THEN RAISE EXCEPTION 'El pago confirmado es inmutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.status = 'CONFIRMED' THEN
    SELECT status INTO session_status FROM cash_sessions WHERE id = NEW."sessionId" FOR UPDATE;
    IF session_status IS DISTINCT FROM 'OPEN' THEN RAISE EXCEPTION 'No se puede cobrar en una caja cerrada'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pos_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON pos_payments FOR EACH ROW EXECUTE FUNCTION pos_guard_payment();

CREATE FUNCTION pos_guard_sale() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'No se borran ventas'; END IF;
  IF OLD."confirmedAt" IS NOT NULL AND
    ((to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') OR OLD.status <> 'CONFIRMED' OR NEW.status NOT IN ('RETURNED','VOIDED')) THEN
    RAISE EXCEPTION 'La venta confirmada es inmutable salvo su estado por devolución';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pos_sale_guard BEFORE UPDATE OR DELETE ON pos_sales FOR EACH ROW EXECUTE FUNCTION pos_guard_sale();

-- Conciliación diferida de venta, pagos, reembolsos y caja al COMMIT.
CREATE FUNCTION pos_check_sale() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_id text; sale_row pos_sales%ROWTYPE; line pos_sale_items%ROWTYPE;
  pay pos_payments%ROWTYPE; refund pos_refunds%ROWTYPE; total_lines numeric; returned_quantity integer;
BEGIN
  IF TG_TABLE_NAME = 'pos_sales' THEN sale_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'pos_refund_items' THEN SELECT "saleId" INTO sale_id FROM pos_refunds WHERE id = NEW."refundId";
  ELSE sale_id := NEW."saleId"; END IF;
  SELECT * INTO sale_row FROM pos_sales WHERE id = sale_id;
  SELECT coalesce(sum("lineTotal"),0) INTO total_lines FROM pos_sale_items WHERE "saleId" = sale_id;
  IF total_lines <> sale_row.total THEN RAISE EXCEPTION 'Total de líneas inconsistente'; END IF;
  IF sale_row."confirmedAt" IS NULL AND
    (EXISTS(SELECT 1 FROM pos_payments WHERE "saleId"=sale_id AND status='CONFIRMED') OR EXISTS(SELECT 1 FROM pos_refunds WHERE "saleId"=sale_id)) THEN RAISE EXCEPTION 'Pendiente con cobros o reembolsos confirmados'; END IF;
  IF sale_row."confirmedAt" IS NOT NULL THEN
    IF sale_row.total <> (SELECT coalesce(sum(amount),0) FROM pos_payments WHERE "saleId"=sale_id AND status='CONFIRMED') THEN RAISE EXCEPTION 'Pagos no conciliados'; END IF;
    FOR line IN SELECT * FROM pos_sale_items WHERE "saleId"=sale_id LOOP
      IF sale_row."orderId" IS NULL AND NOT EXISTS (SELECT 1 FROM inventory_movements WHERE "sourceKey"='pos-sale:'||sale_id||':'||line."productId" AND quantity=line.quantity AND direction='OUT' AND status='CONFIRMED') THEN RAISE EXCEPTION 'Venta sin asiento de stock'; END IF;
      SELECT coalesce(sum(quantity),0) INTO returned_quantity FROM pos_refund_items WHERE "saleItemId"=line.id;
      IF returned_quantity > line.quantity OR (sale_row.status IN ('RETURNED','VOIDED') AND returned_quantity <> line.quantity) THEN RAISE EXCEPTION 'Unidades devueltas inconsistentes'; END IF;
    END LOOP;
    FOR pay IN SELECT * FROM pos_payments WHERE "saleId"=sale_id AND status='CONFIRMED' LOOP
      IF pay.method='cashOnDelivery' AND NOT EXISTS(SELECT 1 FROM cash_entries WHERE "sourceKey"='pos-payment:'||pay.id AND amount=pay.amount AND "sessionId"=pay."sessionId") THEN RAISE EXCEPTION 'Cobro sin asiento de efectivo'; END IF;
      IF pay.method<>'cashOnDelivery' AND EXISTS(SELECT 1 FROM cash_entries WHERE "sourceKey"='pos-payment:'||pay.id) THEN RAISE EXCEPTION 'Un pago digital no puede ingresar efectivo'; END IF;
    END LOOP;
  END IF;
  FOR refund IN SELECT * FROM pos_refunds WHERE "saleId"=sale_id LOOP
    IF refund.amount <> (SELECT coalesce(sum(amount),0) FROM pos_refund_items WHERE "refundId"=refund.id) THEN RAISE EXCEPTION 'Reembolso inconsistente'; END IF;
    IF refund.method='cashOnDelivery' AND refund.amount>0 AND NOT EXISTS(SELECT 1 FROM cash_entries WHERE "sourceKey"='pos-refund:'||refund.id AND amount=-refund.amount AND "sessionId"=refund."sessionId") THEN RAISE EXCEPTION 'Devolución sin asiento de efectivo'; END IF;
    IF refund.method<>'cashOnDelivery' AND EXISTS(SELECT 1 FROM cash_entries WHERE "sourceKey"='pos-refund:'||refund.id) THEN RAISE EXCEPTION 'Un reembolso digital no puede retirar efectivo'; END IF;
  END LOOP;
  IF (SELECT coalesce(sum(amount),0) FROM pos_refunds WHERE "saleId"=sale_id) > sale_row.total THEN RAISE EXCEPTION 'Reembolso mayor que venta'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER pos_sale_consistency AFTER INSERT OR UPDATE ON pos_sales DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_check_sale();
CREATE CONSTRAINT TRIGGER pos_line_consistency AFTER INSERT ON pos_sale_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_check_sale();
CREATE CONSTRAINT TRIGGER pos_payment_consistency AFTER INSERT OR UPDATE ON pos_payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_check_sale();
CREATE CONSTRAINT TRIGGER pos_refund_consistency AFTER INSERT ON pos_refunds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_check_sale();
CREATE CONSTRAINT TRIGGER pos_return_line_consistency AFTER INSERT ON pos_refund_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pos_check_sale();
ALTER TABLE pos_sales ADD COLUMN "cancellationReason" TEXT;
CREATE INDEX "cash_sessions_openedAt_idx" ON cash_sessions("openedAt");
CREATE INDEX "pos_payments_confirmedAt_confirmedById_idx" ON pos_payments("confirmedAt", "confirmedById");
CREATE INDEX "pos_payments_sessionId_idx" ON pos_payments("sessionId");
CREATE INDEX "pos_refunds_saleId_idx" ON pos_refunds("saleId");
COMMIT;
