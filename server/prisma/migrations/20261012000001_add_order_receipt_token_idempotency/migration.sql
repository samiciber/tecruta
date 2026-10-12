BEGIN;

ALTER TABLE "orders"
ADD COLUMN "receiptTokenHash" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

COMMIT;
