-- Critical Security Fix Migration
-- Removes unencrypted access tokens and fixes database security issues

-- 1. CRITICAL: Remove unencrypted access tokens
UPDATE "sessions" SET "accessToken" = NULL WHERE "tokenEncrypted" = true;

-- 2. Add missing foreign key constraints for data integrity
ALTER TABLE "registry_purchases" DROP CONSTRAINT IF EXISTS "registry_purchases_registryId_fkey";

-- Add proper foreign key constraint
ALTER TABLE "registry_purchases" 
ADD CONSTRAINT "registry_purchases_registryItemId_fkey" 
FOREIGN KEY ("registryItemId") REFERENCES "registry_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Add critical performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sessions_shop_encrypted" ON "sessions"("shop", "tokenEncrypted");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_registries_customer_status" ON "registries"("customerId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_registry_purchases_payment_status" ON "registry_purchases"("paymentStatus");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_registry_purchases_fulfillment_status" ON "registry_purchases"("fulfillmentStatus");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_resource_id" ON "audit_logs"("resourceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_system_jobs_priority_status" ON "system_jobs"("priority", "status");

-- 4. Add proper unique constraints
ALTER TABLE "registry_collaborators" 
DROP CONSTRAINT IF EXISTS "registry_collaborators_registryId_email_key";

ALTER TABLE "registry_collaborators" 
ADD CONSTRAINT "registry_collaborators_registryId_email_key" 
UNIQUE ("registryId", "email");

-- 5. Add data validation constraints
ALTER TABLE "registries" 
ADD CONSTRAINT "check_customer_email_format" 
CHECK ("customerEmail" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR "customerEmail" IS NULL);

ALTER TABLE "sessions" 
ADD CONSTRAINT "check_session_security" 
CHECK (
    ("tokenEncrypted" = true AND "accessTokenEncrypted" IS NOT NULL AND "accessTokenIV" IS NOT NULL) 
    OR 
    ("tokenEncrypted" = false AND "accessToken" IS NOT NULL)
);

-- 6. Fix orphaned data cleanup
DELETE FROM "registry_purchases" 
WHERE "registryItemId" NOT IN (SELECT "id" FROM "registry_items");

-- 7. Add session expiry cleanup mechanism
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() 
RETURNS void AS $$
BEGIN
    DELETE FROM "sessions" 
    WHERE "expires" IS NOT NULL AND "expires" < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create automatic cleanup job (if supported)
-- This will need to be scheduled externally if PostgreSQL doesn't support pg_cron