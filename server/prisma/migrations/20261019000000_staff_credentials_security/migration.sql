BEGIN;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users
 ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3),
 ADD COLUMN "ownerRecoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "mfaSecretEncrypted" TEXT,
 ADD COLUMN "mfaPendingSecretEncrypted" TEXT,
 ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "mfaLastStep" INTEGER,
 ADD COLUMN "mfaRecoveryHashes" JSONB;
-- Preserve identities; only the previously provisioned primary account gets email recovery.
UPDATE users SET "ownerRecoveryEnabled" = true
 WHERE role = 'ADMIN' AND "adminUsername" = 'admin1234' AND email IS NOT NULL;
-- Invalidate old panel/Google sessions, without affecting CUSTOMER sessions or business data.
UPDATE users SET "tokenVersion" = COALESCE("tokenVersion",0) + 1, "mustChangePassword" = true,
 "resetCode" = NULL, "resetCodeHash" = NULL, "resetCodeExpiresAt" = NULL
 WHERE role IN ('ADMIN','CASHIER','WAREHOUSE');

CREATE TABLE staff_sessions (
 id TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
 CONSTRAINT "staff_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_sessions_tokenHash_key" ON staff_sessions("tokenHash");
CREATE INDEX "staff_sessions_userId_expiresAt_idx" ON staff_sessions("userId","expiresAt");
CREATE TABLE staff_login_challenges (
 id TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenVersion" INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "staff_login_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_login_challenges_tokenHash_key" ON staff_login_challenges("tokenHash");
CREATE INDEX "staff_login_challenges_expiresAt_idx" ON staff_login_challenges("expiresAt");
CREATE TABLE staff_audit_events (
 id TEXT PRIMARY KEY, "actorId" TEXT, "subjectId" TEXT, action TEXT NOT NULL, detail JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "staff_audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "staff_audit_events_createdAt_id_idx" ON staff_audit_events("createdAt",id);
CREATE INDEX "staff_audit_events_subjectId_createdAt_idx" ON staff_audit_events("subjectId","createdAt");
-- Audit rows are append-only, including direct SQL writes by the application role.
CREATE FUNCTION staff_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'El historial de personal no se modifica ni se elimina'; END $$;
CREATE TRIGGER staff_audit_immutable BEFORE UPDATE OR DELETE ON staff_audit_events
 FOR EACH ROW EXECUTE FUNCTION staff_audit_immutable();
COMMIT;
