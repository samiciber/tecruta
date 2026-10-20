-- Only new events are queued. No historical orders are changed or imported.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE order_email_deliveries (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status "OrderStatus" NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','SENT','REVIEW')),
  "firstAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerId" TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT order_email_deliveries_status_check CHECK (status IN ('PENDING','PAID','SHIPPED','DELIVERED','CANCELLED')),
  CONSTRAINT order_email_deliveries_sent_check CHECK (state <> 'SENT' OR ("sentAt" IS NOT NULL AND "providerId" IS NOT NULL)),
  CONSTRAINT order_email_deliveries_order_status_key UNIQUE ("orderId",status)
);
CREATE INDEX order_email_deliveries_state_created_idx ON order_email_deliveries(state,"createdAt",id);
CREATE FUNCTION queue_order_email_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('PENDING','PAID','SHIPPED','DELIVERED','CANCELLED') THEN
    INSERT INTO order_email_deliveries(id,"orderId",status,"createdAt")
    VALUES ('oe_' || md5(NEW."orderId" || ':' || NEW.status::text),NEW."orderId",NEW.status,NEW."createdAt")
    ON CONFLICT ("orderId",status) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_history_queue_email AFTER INSERT ON order_status_history
FOR EACH ROW EXECUTE FUNCTION queue_order_email_delivery();
COMMIT;
