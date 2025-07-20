-- Add Critical Database Indexes for Performance
-- These indexes are essential for query performance and Shopify 2025 compliance

-- Sessions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_shop_idx" ON "sessions"("shop");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_expires_idx" ON "sessions"("expires") WHERE "expires" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_access_token_encrypted_idx" ON "sessions"("accessTokenEncrypted") WHERE "accessTokenEncrypted" IS NOT NULL;

-- Shops table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "shops_domain_idx" ON "shops"("domain");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "shops_created_at_idx" ON "shops"("createdAt");

-- Registries table additional indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_slug_idx" ON "registries"("slug");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_customer_email_idx" ON "registries"("customerEmail");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_created_at_idx" ON "registries"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registries_event_date_idx" ON "registries"("eventDate") WHERE "eventDate" IS NOT NULL;

-- Registry items additional indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_items_product_handle_idx" ON "registry_items"("productHandle");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_items_created_at_idx" ON "registry_items"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_items_inventory_sync_idx" ON "registry_items"("lastInventorySync");

-- Registry purchases additional indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_purchases_created_at_idx" ON "registry_purchases"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_purchases_payment_status_idx" ON "registry_purchases"("paymentStatus");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_purchases_fulfillment_status_idx" ON "registry_purchases"("fulfillmentStatus");

-- Audit logs additional indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_user_email_idx" ON "audit_logs"("userEmail") WHERE "userEmail" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_resource_id_idx" ON "audit_logs"("resourceId");

-- System jobs additional indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "system_jobs_shop_id_idx" ON "system_jobs"("shopId") WHERE "shopId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "system_jobs_registry_id_idx" ON "system_jobs"("registryId") WHERE "registryId" IS NOT NULL;

-- Registry collaborators additional indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_collaborators_invite_token_idx" ON "registry_collaborators"("inviteToken") WHERE "inviteToken" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_collaborators_accepted_at_idx" ON "registry_collaborators"("acceptedAt") WHERE "acceptedAt" IS NOT NULL;

-- Registry activities composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_activities_registry_type_created_idx" ON "registry_activities"("registryId", "type", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_activities_actor_email_created_idx" ON "registry_activities"("actorEmail", "createdAt") WHERE "actorEmail" IS NOT NULL;

-- Analytics events composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_events_shop_event_timestamp_idx" ON "analytics_events"("shopId", "event", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_events_registry_timestamp_idx" ON "analytics_events"("registryId", "timestamp") WHERE "registryId" IS NOT NULL;

-- Group gift contributions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "group_gift_contributions_created_at_idx" ON "group_gift_contributions"("createdAt");

-- Metafield syncs composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "metafield_syncs_shop_status_idx" ON "metafield_syncs"("shopId", "status");

-- Registry addresses indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_addresses_is_default_idx" ON "registry_addresses"("isDefault") WHERE "isDefault" = true;

-- Registry invitations composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "registry_invitations_registry_status_idx" ON "registry_invitations"("registryId", "deliveryStatus");

-- Performance metrics time-based partitioning index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "performance_metrics_shop_created_idx" ON "performance_metrics"("shopId", "createdAt");

-- Security audit table indexes (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_audit') THEN
    CREATE INDEX CONCURRENTLY IF NOT EXISTS "security_audit_resource_timestamp_idx" ON "security_audit"("resource", "timestamp");
  END IF;
END $$;