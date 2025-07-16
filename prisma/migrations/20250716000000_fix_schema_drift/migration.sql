-- Fix Schema Drift - Add Missing Fields from Prisma Schema
-- Critical migration to align database with Prisma schema

-- Add missing fields to registries table
ALTER TABLE "registries" ADD COLUMN IF NOT EXISTS "customerEmailHash" TEXT;
ALTER TABLE "registries" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "registries" ADD COLUMN IF NOT EXISTS "lastAccessedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "registries" ADD COLUMN IF NOT EXISTS "privacyMetadata" JSONB DEFAULT '{}';

-- Add missing fields to shops table
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "complianceMetadata" JSONB DEFAULT '{}';
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "dataRetentionPeriod" INTEGER DEFAULT 2555;
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "lastDataCleanup" TIMESTAMP(3);

-- Fix registry_collaborators table schema
ALTER TABLE "registry_collaborators" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "registry_collaborators" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "registry_collaborators" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "registry_collaborators" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- Update permissions column to TEXT if not already
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'registry_collaborators' AND column_name = 'permissions' AND data_type != 'text') THEN
    ALTER TABLE "registry_collaborators" ALTER COLUMN "permissions" TYPE TEXT;
  END IF;
END $$;

-- Set default value for permissions
ALTER TABLE "registry_collaborators" ALTER COLUMN "permissions" SET DEFAULT 'read_write';

-- Add critical indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_customer_email_hash_idx" ON "registries"("customerEmailHash") WHERE "customerEmailHash" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_soft_delete_idx" ON "registries"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_last_accessed_idx" ON "registries"("lastAccessedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "shops_data_cleanup_idx" ON "shops"("lastDataCleanup");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_collaborators_names_idx" ON "registry_collaborators"("firstName", "lastName");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_collaborators_activity_idx" ON "registry_collaborators"("lastActiveAt");

-- Add performance metrics table if not exists
CREATE TABLE IF NOT EXISTS "performance_metrics" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "metricUnit" TEXT NOT NULL,
    "userAgent" TEXT,
    "path" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- Add indexes for performance metrics
CREATE INDEX IF NOT EXISTS "performance_metrics_shopId_idx" ON "performance_metrics"("shopId");
CREATE INDEX IF NOT EXISTS "performance_metrics_metricType_idx" ON "performance_metrics"("metricType");
CREATE INDEX IF NOT EXISTS "performance_metrics_timestamp_idx" ON "performance_metrics"("timestamp");
CREATE INDEX IF NOT EXISTS "performance_metrics_shopId_metricType_timestamp_idx" ON "performance_metrics"("shopId", "metricType", "timestamp");

-- Add API response time tracking table
CREATE TABLE IF NOT EXISTS "api_response_times" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_response_times_pkey" PRIMARY KEY ("id")
);

-- Add indexes for API response times
CREATE INDEX IF NOT EXISTS "api_response_times_shopId_idx" ON "api_response_times"("shopId");
CREATE INDEX IF NOT EXISTS "api_response_times_endpoint_idx" ON "api_response_times"("endpoint");
CREATE INDEX IF NOT EXISTS "api_response_times_timestamp_idx" ON "api_response_times"("timestamp");
CREATE INDEX IF NOT EXISTS "api_response_times_p95_idx" ON "api_response_times"("shopId", "endpoint", "timestamp", "responseTime");

-- Add foreign key constraints if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'performance_metrics_shopId_fkey') THEN
    ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_shopId_fkey" 
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'api_response_times_shopId_fkey') THEN
    ALTER TABLE "api_response_times" ADD CONSTRAINT "api_response_times_shopId_fkey" 
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Clean up orphaned records before adding constraints
DELETE FROM "sessions" WHERE "shopId" NOT IN (SELECT "id" FROM "shops");
DELETE FROM "audit_logs" WHERE "shopId" NOT IN (SELECT "id" FROM "shops");
DELETE FROM "system_jobs" WHERE "shopId" NOT IN (SELECT "id" FROM "shops");

-- Update schema version
UPDATE "_prisma_migrations" SET "applied_steps_count" = "applied_steps_count" + 1 WHERE "migration_name" = '20250716000000_fix_schema_drift';