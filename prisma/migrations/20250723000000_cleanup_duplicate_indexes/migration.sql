-- Clean up duplicate and inefficient indexes
-- Based on audit findings of over-indexing and duplicate index patterns

-- Drop duplicate session indexes (keeping the most efficient ones)
DROP INDEX IF EXISTS "sessions_shop_idx";
DROP INDEX IF EXISTS "sessions_userId_idx"; 
DROP INDEX IF EXISTS "sessions_email_idx";

-- Drop overlapping registry indexes
DROP INDEX IF EXISTS "registries_customerId_idx";
DROP INDEX IF EXISTS "registries_shopId_eventType_idx";

-- Drop duplicate registry_purchases indexes  
DROP INDEX IF EXISTS "registry_purchases_purchaserEmail_idx";
DROP INDEX IF EXISTS "registry_purchases_orderId_idx";

-- Drop redundant audit log indexes
DROP INDEX IF EXISTS "audit_logs_shopId_timestamp_idx";
DROP INDEX IF EXISTS "audit_logs_action_timestamp_idx";

-- Drop performance metrics duplicates
DROP INDEX IF EXISTS "performance_metrics_shopId_metricType_idx";

-- Create optimized composite indexes to replace multiple single-column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_shop_tokenEncrypted_idx" 
ON "sessions" ("shop", "tokenEncrypted");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_shopId_status_eventType_idx" 
ON "registries" ("shopId", "status", "eventType");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_purchases_registryItemId_status_idx" 
ON "registry_purchases" ("registryItemId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_shopId_action_timestamp_idx" 
ON "audit_logs" ("shopId", "action", "timestamp" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "performance_metrics_shopId_metricType_createdAt_idx" 
ON "performance_metrics" ("shopId", "metricType", "createdAt" DESC);

-- Add covering indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_items_registryId_status_priority_idx" 
ON "registry_items" ("registryId", "status", "priority") 
INCLUDE ("productTitle", "price", "quantity");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_collaborators_registryId_status_role_idx" 
ON "registry_collaborators" ("registryId", "status", "role") 
INCLUDE ("email", "name");

-- Optimize foreign key indexes for CASCADE operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_activities_registryId_type_createdAt_idx" 
ON "registry_activities" ("registryId", "type", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "group_gift_contributions_purchaseId_paymentStatus_idx" 
ON "group_gift_contributions" ("purchaseId", "paymentStatus");

-- Add partial indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_active_public_idx" 
ON "registries" ("shopId", "createdAt" DESC) 
WHERE "status" = 'active' AND "visibility" = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_items_active_in_stock_idx" 
ON "registry_items" ("registryId", "priority", "createdAt") 
WHERE "status" = 'active' AND "quantityPurchased" < "quantity";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_valid_online_idx" 
ON "sessions" ("shop", "expires") 
WHERE "isOnline" = true AND "expires" > NOW();

-- Performance monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "performance_metrics_recent_idx" 
ON "performance_metrics" ("metricType", "createdAt" DESC) 
WHERE "createdAt" > NOW() - INTERVAL '24 hours';

-- Security audit indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "security_audit_recent_failures_idx" 
ON "security_audit" ("action", "timestamp" DESC) 
WHERE "status" = 'failed' AND "timestamp" > NOW() - INTERVAL '7 days';