-- Add missing foreign key constraints to prevent orphaned records

-- Add shopId to sessions table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'shopId') THEN
        ALTER TABLE "sessions" ADD COLUMN "shopId" TEXT;
    END IF;
END $$;

-- Add shopId to audit_logs table if not exists  
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'shopId') THEN
        ALTER TABLE "audit_logs" ADD COLUMN "shopId" TEXT;
    END IF;
END $$;

-- Add shopId to system_jobs table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_jobs' AND column_name = 'shopId') THEN
        ALTER TABLE "system_jobs" ADD COLUMN "shopId" TEXT;
    END IF;
END $$;

-- Update existing records to have proper shopId references
-- For sessions, try to derive shopId from the shop column
UPDATE "sessions" SET "shopId" = (
    SELECT "id" FROM "shops" WHERE "shops"."domain" = "sessions"."shop"
) WHERE "shopId" IS NULL AND "shop" IS NOT NULL;

-- For audit_logs, try to derive shopId from existing data
-- This is a best-effort approach - in production you'd need business logic
UPDATE "audit_logs" SET "shopId" = (
    SELECT "id" FROM "shops" LIMIT 1
) WHERE "shopId" IS NULL;

-- For system_jobs, assign to default shop
UPDATE "system_jobs" SET "shopId" = (
    SELECT "id" FROM "shops" LIMIT 1  
) WHERE "shopId" IS NULL;

-- Make shopId NOT NULL after updating
ALTER TABLE "sessions" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "system_jobs" ALTER COLUMN "shopId" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "system_jobs" ADD CONSTRAINT "system_jobs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "sessions_shopId_idx" ON "sessions"("shopId");
CREATE INDEX IF NOT EXISTS "audit_logs_shopId_idx" ON "audit_logs"("shopId");
CREATE INDEX IF NOT EXISTS "system_jobs_shopId_idx" ON "system_jobs"("shopId");

-- Add missing indexes for cleanup operations
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions"("expires");
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "system_jobs_status_runAt_idx" ON "system_jobs"("status", "runAt");