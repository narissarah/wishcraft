-- Optimize Indexes for Better Performance

-- Sessions: Add composite index for authentication lookups
CREATE INDEX IF NOT EXISTS "sessions_shop_state_idx" ON "sessions"("shop", "state");

-- Shops: Add index for compliance queries
CREATE INDEX IF NOT EXISTS "shops_data_retention_period_idx" ON "shops"("dataRetentionPeriod") WHERE "dataRetentionPeriod" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "shops_last_data_cleanup_idx" ON "shops"("lastDataCleanup") WHERE "lastDataCleanup" IS NOT NULL;

-- Registries: Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS "registries_shop_visibility_idx" ON "registries"("shopId", "visibility");
CREATE INDEX IF NOT EXISTS "registries_shop_event_date_idx" ON "registries"("shopId", "eventDate") WHERE "eventDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "registries_customer_status_idx" ON "registries"("customerId", "status");
CREATE INDEX IF NOT EXISTS "registries_event_type_status_idx" ON "registries"("eventType", "status");
CREATE INDEX IF NOT EXISTS "registries_collaboration_enabled_idx" ON "registries"("collaborationEnabled") WHERE "collaborationEnabled" = true;
CREATE INDEX IF NOT EXISTS "registries_last_accessed_at_idx" ON "registries"("lastAccessedAt") WHERE "lastAccessedAt" IS NOT NULL;

-- Registry Items: Add indexes for inventory queries
CREATE INDEX IF NOT EXISTS "registry_items_inventory_tracked_quantity_idx" ON "registry_items"("inventoryTracked", "inventoryQuantity") WHERE "inventoryTracked" = true;
CREATE INDEX IF NOT EXISTS "registry_items_registry_priority_idx" ON "registry_items"("registryId", "priority");
CREATE INDEX IF NOT EXISTS "registry_items_quantity_purchased_idx" ON "registry_items"("quantityPurchased") WHERE "quantityPurchased" > 0;

-- Registry Purchases: Add indexes for reporting
CREATE INDEX IF NOT EXISTS "registry_purchases_created_at_idx" ON "registry_purchases"("createdAt");
CREATE INDEX IF NOT EXISTS "registry_purchases_registry_created_at_idx" ON "registry_purchases"("registryId", "createdAt");
CREATE INDEX IF NOT EXISTS "registry_purchases_purchaser_email_idx" ON "registry_purchases"("purchaserEmail") WHERE "purchaserEmail" IS NOT NULL;

-- Audit Logs: Add composite index for efficient queries
CREATE INDEX IF NOT EXISTS "audit_logs_shop_action_timestamp_idx" ON "audit_logs"("shopId", "action", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resourceId");
CREATE INDEX IF NOT EXISTS "audit_logs_user_email_idx" ON "audit_logs"("userEmail") WHERE "userEmail" IS NOT NULL;

-- System Jobs: Add index for job processing
CREATE INDEX IF NOT EXISTS "system_jobs_status_run_at_idx" ON "system_jobs"("status", "runAt") WHERE "status" = 'pending';
CREATE INDEX IF NOT EXISTS "system_jobs_shop_type_status_idx" ON "system_jobs"("shopId", "type", "status");
CREATE INDEX IF NOT EXISTS "system_jobs_completed_at_idx" ON "system_jobs"("completedAt") WHERE "completedAt" IS NOT NULL;

-- Performance Metrics: Add indexes for analytics
CREATE INDEX IF NOT EXISTS "performance_metrics_metric_type_value_idx" ON "performance_metrics"("metricType", "metricValue");
CREATE INDEX IF NOT EXISTS "performance_metrics_shop_created_at_idx" ON "performance_metrics"("shopId", "createdAt");
CREATE INDEX IF NOT EXISTS "performance_metrics_url_idx" ON "performance_metrics"("url") WHERE "url" IS NOT NULL;

-- Registry Collaborators: Add indexes for collaboration queries
CREATE INDEX IF NOT EXISTS "registry_collaborators_email_status_idx" ON "registry_collaborators"("email", "status");
CREATE INDEX IF NOT EXISTS "registry_collaborators_invited_by_idx" ON "registry_collaborators"("invitedBy") WHERE "invitedBy" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "registry_collaborators_accepted_at_idx" ON "registry_collaborators"("acceptedAt") WHERE "acceptedAt" IS NOT NULL;

-- Registry Activities: Add indexes for activity feeds
CREATE INDEX IF NOT EXISTS "registry_activities_registry_actor_email_idx" ON "registry_activities"("registryId", "actorEmail");
CREATE INDEX IF NOT EXISTS "registry_activities_is_system_idx" ON "registry_activities"("isSystem") WHERE "isSystem" = true;

-- Add GIN index for JSON search on metadata fields (PostgreSQL specific)
CREATE INDEX IF NOT EXISTS "shops_compliance_metadata_gin_idx" ON "shops" USING GIN ("complianceMetadata");
CREATE INDEX IF NOT EXISTS "registries_collaboration_settings_gin_idx" ON "registries" USING GIN ("collaborationSettings");
CREATE INDEX IF NOT EXISTS "registries_privacy_metadata_gin_idx" ON "registries" USING GIN ("privacyMetadata");
CREATE INDEX IF NOT EXISTS "registry_activities_metadata_gin_idx" ON "registry_activities" USING GIN ("metadata");

-- Create text search index for registry search
CREATE INDEX IF NOT EXISTS "registries_title_search_idx" ON "registries" USING GIN (to_tsvector('english', "title"));
CREATE INDEX IF NOT EXISTS "registries_description_search_idx" ON "registries" USING GIN (to_tsvector('english', "description")) WHERE "description" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "registry_items_product_title_search_idx" ON "registry_items" USING GIN (to_tsvector('english', "productTitle"));

-- Add covering indexes for common queries to avoid table lookups
CREATE INDEX IF NOT EXISTS "registries_list_covering_idx" ON "registries"("shopId", "status", "createdAt") INCLUDE ("title", "eventType", "visibility", "customerId");
CREATE INDEX IF NOT EXISTS "registry_items_list_covering_idx" ON "registry_items"("registryId", "status") INCLUDE ("productId", "variantId", "quantity", "quantityPurchased", "price");

-- Update statistics for query planner
ANALYZE;