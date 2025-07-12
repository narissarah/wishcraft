-- CreateIndex for performance optimization based on deep analysis
-- These indexes optimize complex queries identified in the codebase

-- Registry queries by shop and status (most common pattern)
CREATE INDEX "registries_shopId_status_idx" ON "registries"("shopId", "status");

-- Registry item queries by registry and status
CREATE INDEX "registry_items_registryId_status_idx" ON "registry_items"("registryId", "status");

-- Audit log queries by shop and timestamp for analytics
CREATE INDEX "audit_logs_shopId_timestamp_idx" ON "audit_logs"("shopId", "timestamp");

-- System job processing queue optimization  
CREATE INDEX "system_jobs_status_priority_runAt_idx" ON "system_jobs"("status", "priority", "runAt");

-- Session lookups by shop and user
CREATE INDEX "sessions_shop_userId_idx" ON "sessions"("shop", "userId");

-- Registry collaborator queries by registry and status
CREATE INDEX "registry_collaborators_registryId_status_idx" ON "registry_collaborators"("registryId", "status");

-- Analytics events by shop and timestamp for reporting
CREATE INDEX "analytics_events_shopId_timestamp_idx" ON "analytics_events"("shopId", "timestamp");

-- Registry purchase tracking by registry and status
CREATE INDEX "registry_purchases_registryId_status_idx" ON "registry_purchases"("registryId", "status");

-- Customer registry lookups with event date
CREATE INDEX "registries_customerId_eventDate_idx" ON "registries"("customerId", "eventDate");

-- Product inventory sync optimization
CREATE INDEX "registry_items_productId_inventoryTracked_idx" ON "registry_items"("productId", "inventoryTracked");