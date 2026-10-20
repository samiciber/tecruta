-- Additive only. No historical reviews or ratings are manufactured.
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
ALTER TABLE products ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ratingSum" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT products_rating_totals_check CHECK ("ratingCount" >= 0 AND "ratingSum" >= "ratingCount" AND "ratingSum" <= 5::bigint * "ratingCount");
CREATE TABLE product_reviews (
 id TEXT PRIMARY KEY, "productId" TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 "orderItemId" TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
 rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
 title VARCHAR(80), text VARCHAR(1000) NOT NULL CHECK (char_length(btrim(text)) BETWEEN 10 AND 1000),
 status "ReviewStatus" NOT NULL DEFAULT 'PENDING',
 "storeReply" VARCHAR(1000), "rejectionReason" VARCHAR(500),
 "moderatedById" TEXT REFERENCES users(id) ON DELETE RESTRICT,
 "moderatedAt" TIMESTAMP(3), "repliedAt" TIMESTAMP(3),
 "helpfulCount" INTEGER NOT NULL DEFAULT 0 CHECK ("helpfulCount" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT review_rejection_reason_check CHECK (status <> 'REJECTED' OR char_length(btrim("rejectionReason")) >= 5)
);
CREATE UNIQUE INDEX product_reviews_orderItemId_key ON product_reviews("orderItemId");
CREATE UNIQUE INDEX product_reviews_userId_productId_key ON product_reviews("userId","productId");
CREATE INDEX product_reviews_productId_status_createdAt_id_idx ON product_reviews("productId",status,"createdAt",id);
CREATE INDEX product_reviews_productId_status_helpfulCount_createdAt_id_idx ON product_reviews("productId",status,"helpfulCount","createdAt",id);
CREATE INDEX product_reviews_status_createdAt_id_idx ON product_reviews(status,"createdAt",id);
CREATE TABLE review_helpful_votes (
 id TEXT PRIMARY KEY, "reviewId" TEXT NOT NULL REFERENCES product_reviews(id) ON DELETE RESTRICT,
 "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX review_helpful_votes_reviewId_userId_key ON review_helpful_votes("reviewId","userId");
CREATE TABLE review_invitations (
 id TEXT PRIMARY KEY, "orderItemId" TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMP(3), "providerId" TEXT
);
CREATE UNIQUE INDEX review_invitations_orderItemId_key ON review_invitations("orderItemId");
