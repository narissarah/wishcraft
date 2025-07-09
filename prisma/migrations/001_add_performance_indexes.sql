-- Performance optimization indexes for WishCraft
-- Run these after the initial migration

-- Registry performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_shop_status_updated 
  ON registries(shop_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_customer_event 
  ON registries(customer_id, event_type, event_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_visibility_created 
  ON registries(visibility, created_at DESC) 
  WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_slug_hash 
  ON registries USING hash(slug);

-- Registry items performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_registry_status_order 
  ON registry_items(registry_id, status, display_order) 
  WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_product_inventory 
  ON registry_items(product_id, inventory_quantity) 
  WHERE inventory_tracked = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_priority_created 
  ON registry_items(priority, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_product_variant 
  ON registry_items(product_id, variant_id);

-- Purchase performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_item_status 
  ON registry_purchases(registry_item_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_group_gift 
  ON registry_purchases(group_gift_id, status) 
  WHERE group_gift_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_purchaser_date 
  ON registry_purchases(purchaser_email, created_at DESC) 
  WHERE purchaser_email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_order_status 
  ON registry_purchases(order_id, status) 
  WHERE order_id IS NOT NULL;

-- Group gift contributions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_contributions_purchase_status 
  ON group_gift_contributions(purchase_id, payment_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_contributions_email_created 
  ON group_gift_contributions(contributor_email, created_at DESC);

-- Activity tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_registry_type_date 
  ON registry_activities(registry_id, type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_actor_date 
  ON registry_activities(actor_email, created_at DESC) 
  WHERE actor_email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_session_type 
  ON registry_activities(session_id, type, created_at) 
  WHERE session_id IS NOT NULL;

-- Analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_shop_event_timestamp 
  ON analytics_events(shop_id, event, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_registry_category 
  ON analytics_events(registry_id, category, timestamp DESC) 
  WHERE registry_id IS NOT NULL;

-- Collaborator indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collaborators_email_status 
  ON registry_collaborators(email, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collaborators_registry_role 
  ON registry_collaborators(registry_id, role, status);

-- Address indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_registry_type 
  ON registry_addresses(registry_id, type, is_default);

-- Invitation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invitations_registry_status 
  ON registry_invitations(registry_id, delivery_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invitations_email_type 
  ON registry_invitations(email, invite_type, delivery_status);

-- System job indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_jobs_status_priority_run 
  ON system_jobs(status, priority, run_at) 
  WHERE status IN ('pending', 'running');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_jobs_type_shop 
  ON system_jobs(type, shop_id, created_at DESC) 
  WHERE shop_id IS NOT NULL;

-- Metafield sync indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metafield_sync_shop_status 
  ON metafield_syncs(shop_id, status, last_sync_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metafield_sync_owner_namespace 
  ON metafield_syncs(owner_id, namespace, key);

-- Audit log indexes (for compliance and debugging)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_shop_timestamp 
  ON audit_logs(shop_id, timestamp DESC) 
  WHERE shop_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_action 
  ON audit_logs(resource, action, timestamp DESC);

-- Full-text search indexes (PostgreSQL specific)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_fulltext 
  ON registries USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_fulltext 
  ON registry_items USING gin(to_tsvector('english', product_title || ' ' || COALESCE(description, '')));

-- Partial indexes for hot data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_active_recent 
  ON registries(updated_at DESC) 
  WHERE status = 'active' AND updated_at > (CURRENT_DATE - INTERVAL '30 days');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_recent_pending 
  ON registry_purchases(created_at DESC) 
  WHERE status = 'pending' AND created_at > (CURRENT_DATE - INTERVAL '7 days');

-- Expression indexes for computed values
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registries_completion_high 
  ON registries(completion_rate DESC) 
  WHERE completion_rate > 0.8;

-- Hash indexes for exact lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_items_product_hash 
  ON registry_items USING hash(product_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_order_hash 
  ON registry_purchases USING hash(order_id) 
  WHERE order_id IS NOT NULL;

-- Optimize statistics collection
ANALYZE registries;
ANALYZE registry_items;
ANALYZE registry_purchases;
ANALYZE group_gift_contributions;
ANALYZE registry_activities;
ANALYZE analytics_events;