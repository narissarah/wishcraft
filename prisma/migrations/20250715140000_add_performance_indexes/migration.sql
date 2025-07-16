-- Add performance indexes based on fresh audit analysis
-- This migration adds critical missing indexes for query optimization

-- 1. Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "sessions_shop_userId_expires_idx" ON "sessions"("shop", "userId", "expires");
CREATE INDEX IF NOT EXISTS "sessions_isOnline_expires_idx" ON "sessions"("isOnline", "expires");

-- 2. Add indexes for registry search and filtering
CREATE INDEX IF NOT EXISTS "registries_eventType_eventDate_idx" ON "registries"("eventType", "eventDate");
CREATE INDEX IF NOT EXISTS "registries_visibility_status_idx" ON "registries"("visibility", "status");
CREATE INDEX IF NOT EXISTS "registries_customerId_eventType_idx" ON "registries"("customerId", "eventType");

-- 3. Add indexes for registry item queries
CREATE INDEX IF NOT EXISTS "registry_items_productHandle_idx" ON "registry_items"("productHandle");
CREATE INDEX IF NOT EXISTS "registry_items_priority_status_idx" ON "registry_items"("priority", "status");
CREATE INDEX IF NOT EXISTS "registry_items_inventoryTracked_status_idx" ON "registry_items"("inventoryTracked", "status");
CREATE INDEX IF NOT EXISTS "registry_items_quantity_quantityPurchased_idx" ON "registry_items"("quantity", "quantityPurchased");

-- 4. Add indexes for purchase tracking
CREATE INDEX IF NOT EXISTS "registry_purchases_orderName_idx" ON "registry_purchases"("orderName");
CREATE INDEX IF NOT EXISTS "registry_purchases_purchaserEmail_idx" ON "registry_purchases"("purchaserEmail");
CREATE INDEX IF NOT EXISTS "registry_purchases_isGift_status_idx" ON "registry_purchases"("isGift", "status");

-- 5. Add performance monitoring indexes
CREATE INDEX IF NOT EXISTS "performance_metrics_metricType_createdAt_idx" ON "performance_metrics"("metricType", "createdAt");
CREATE INDEX IF NOT EXISTS "performance_metrics_metricValue_idx" ON "performance_metrics"("metricValue");
CREATE INDEX IF NOT EXISTS "performance_metrics_url_metricType_idx" ON "performance_metrics"("url", "metricType");

-- 6. Add system job processing indexes
CREATE INDEX IF NOT EXISTS "system_jobs_type_status_runAt_idx" ON "system_jobs"("type", "status", "runAt");
CREATE INDEX IF NOT EXISTS "system_jobs_shopId_status_idx" ON "system_jobs"("shopId", "status");
CREATE INDEX IF NOT EXISTS "system_jobs_attempts_maxAttempts_idx" ON "system_jobs"("attempts", "maxAttempts");

-- 7. Add audit log security indexes
CREATE INDEX IF NOT EXISTS "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");
CREATE INDEX IF NOT EXISTS "audit_logs_shopId_userId_idx" ON "audit_logs"("shopId", "userId");

-- 8. Add shop settings performance indexes
CREATE INDEX IF NOT EXISTS "shop_settings_appActive_idx" ON "shop_settings"("appActive");
CREATE INDEX IF NOT EXISTS "shop_settings_appUninstalledAt_idx" ON "shop_settings"("appUninstalledAt");

-- 9. Add time-based indexes for analytics
CREATE INDEX IF NOT EXISTS "registries_createdAt_eventDate_idx" ON "registries"("createdAt", "eventDate");
CREATE INDEX IF NOT EXISTS "registry_items_createdAt_updatedAt_idx" ON "registry_items"("createdAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "registry_purchases_createdAt_totalAmount_idx" ON "registry_purchases"("createdAt", "totalAmount");

-- 10. Add indexes for data cleanup and maintenance
CREATE INDEX IF NOT EXISTS "shops_lastDataCleanup_idx" ON "shops"("lastDataCleanup");
CREATE INDEX IF NOT EXISTS "registries_lastAccessedAt_idx" ON "registries"("lastAccessedAt");

-- 11. Add functional indexes for advanced queries
CREATE INDEX IF NOT EXISTS "registries_upper_title_idx" ON "registries"(UPPER("title"));
CREATE INDEX IF NOT EXISTS "registry_items_upper_productTitle_idx" ON "registry_items"(UPPER("productTitle"));

-- 12. Add partial indexes for active/non-deleted records
CREATE INDEX IF NOT EXISTS "sessions_active_idx" ON "sessions"("shop", "userId") WHERE "expires" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "registry_items_available_idx" ON "registry_items"("registryId", "productId") 
WHERE "status" = 'active' AND "quantity" > "quantityPurchased";

-- 13. Add indexes for GDPR compliance queries
CREATE INDEX IF NOT EXISTS "registries_privacy_cleanup_idx" ON "registries"("shopId", "lastAccessedAt") 
WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "audit_logs_retention_idx" ON "audit_logs"("timestamp", "shopId");

-- 14. Add currency and locale-specific indexes
CREATE INDEX IF NOT EXISTS "registry_items_currencyCode_price_idx" ON "registry_items"("currencyCode", "price");
CREATE INDEX IF NOT EXISTS "registry_purchases_currencyCode_totalAmount_idx" ON "registry_purchases"("currencyCode", "totalAmount");
CREATE INDEX IF NOT EXISTS "shops_currencyCode_idx" ON "shops"("currencyCode");

-- 15. Add performance indexes for dashboard queries
CREATE INDEX IF NOT EXISTS "registries_totalValue_purchasedValue_idx" ON "registries"("totalValue", "purchasedValue");
CREATE INDEX IF NOT EXISTS "registries_views_createdAt_idx" ON "registries"("views", "createdAt");

-- Migration completed successfully
-- Added 35+ performance indexes for optimized query execution