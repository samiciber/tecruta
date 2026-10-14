BEGIN;

ALTER TABLE "users"
ADD COLUMN "verificationCodeHash" TEXT,
ADD COLUMN "verificationCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "verificationCodeAttempts" INTEGER,
ADD COLUMN "verificationCodeLockedUntil" TIMESTAMP(3),
ADD COLUMN "verificationCodeSentAt" TIMESTAMP(3),
ADD COLUMN "resetCodeHash" TEXT,
ADD COLUMN "resetCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "resetCodeAttempts" INTEGER,
ADD COLUMN "resetCodeLockedUntil" TIMESTAMP(3),
ADD COLUMN "resetCodeSentAt" TIMESTAMP(3),
ADD COLUMN "tokenVersion" INTEGER DEFAULT 0;

-- Existing plaintext codes have no safe expiry/attempt counter. Request new ones.
UPDATE "users" SET "verificationCode" = NULL, "resetCode" = NULL
WHERE "verificationCode" IS NOT NULL OR "resetCode" IS NOT NULL;

CREATE TABLE "oauth_flows" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "bindingHash" TEXT NOT NULL,
    "exchangeChallenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_flows_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "auth_exchanges" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "exchangeChallenge" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_exchanges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_flows_stateHash_key" ON "oauth_flows"("stateHash");
CREATE INDEX "oauth_flows_expiresAt_idx" ON "oauth_flows"("expiresAt");
CREATE UNIQUE INDEX "auth_exchanges_codeHash_key" ON "auth_exchanges"("codeHash");
CREATE INDEX "auth_exchanges_expiresAt_idx" ON "auth_exchanges"("expiresAt");
ALTER TABLE "auth_exchanges" ADD CONSTRAINT "auth_exchanges_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
