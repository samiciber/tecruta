-- Additive only: existing users retain their email, password, Google identity and role.
ALTER TABLE "users" ADD COLUMN "adminUsername" TEXT;
CREATE UNIQUE INDEX "users_adminUsername_key" ON "users"("adminUsername");
ALTER TABLE "users" ADD CONSTRAINT "users_adminUsername_format_check"
CHECK ("adminUsername" IS NULL OR "adminUsername" ~ '^[a-z0-9][a-z0-9_-]{3,31}$');
