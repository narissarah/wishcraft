-- Performance Metrics Table for Core Web Vitals
CREATE TABLE IF NOT EXISTS performance_metrics (
  id VARCHAR(30) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  metric VARCHAR(20) NOT NULL,
  value NUMERIC(10, 2) NOT NULL,
  rating VARCHAR(20) NOT NULL,
  path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_performance_metric ON performance_metrics (metric);
CREATE INDEX IF NOT EXISTS idx_performance_created ON performance_metrics (created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metric_created ON performance_metrics (metric, created_at);

-- GraphQL Query Performance Tracking
CREATE TABLE IF NOT EXISTS graphql_queries (
  id VARCHAR(30) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  query_name VARCHAR(100) NOT NULL,
  duration NUMERIC(10, 2) NOT NULL,
  complexity INTEGER NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_graphql_query_name ON graphql_queries (query_name);
CREATE INDEX IF NOT EXISTS idx_graphql_duration ON graphql_queries (duration);
CREATE INDEX IF NOT EXISTS idx_graphql_created ON graphql_queries (created_at);
CREATE INDEX IF NOT EXISTS idx_graphql_slow_queries ON graphql_queries (created_at, duration) WHERE duration > 1000;

-- Webhook Event Tracking
CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(30) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic VARCHAR(100) NOT NULL,
  shop_domain VARCHAR(255) NOT NULL,
  latency NUMERIC(10, 2) NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  payload_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_topic ON webhook_events (topic);
CREATE INDEX IF NOT EXISTS idx_webhook_shop ON webhook_events (shop_domain);
CREATE INDEX IF NOT EXISTS idx_webhook_created ON webhook_events (created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_failures ON webhook_events (created_at, success) WHERE success = FALSE;

-- Bundle Size Tracking
CREATE TABLE IF NOT EXISTS bundle_metrics (
  id VARCHAR(30) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  build_id VARCHAR(100) NOT NULL,
  chunk_name VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  gzip_size_bytes INTEGER NOT NULL,
  parse_time NUMERIC(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bundle_build ON bundle_metrics (build_id);
CREATE INDEX IF NOT EXISTS idx_bundle_created ON bundle_metrics (created_at);

-- Create views for performance analytics
CREATE OR REPLACE VIEW performance_summary AS
SELECT 
  metric,
  COUNT(*) as sample_count,
  AVG(value) as avg_value,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75_value,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  DATE(created_at) as date
FROM performance_metrics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY metric, DATE(created_at);

CREATE OR REPLACE VIEW slow_queries_daily AS
SELECT 
  DATE(created_at) as date,
  query_name,
  COUNT(*) as execution_count,
  AVG(duration) as avg_duration,
  MAX(duration) as max_duration,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate
FROM graphql_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), query_name
HAVING AVG(duration) > 500
ORDER BY date DESC, avg_duration DESC;

-- Add performance tracking columns to existing tables
ALTER TABLE shops ADD COLUMN IF NOT EXISTS performance_score NUMERIC(5, 2);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_performance_check TIMESTAMP;

-- Create performance alert rules table
CREATE TABLE IF NOT EXISTS performance_alerts (
  id VARCHAR(30) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alert_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  threshold_value NUMERIC(10, 2) NOT NULL,
  current_value NUMERIC(10, 2) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_type ON performance_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_severity ON performance_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_alert_unresolved ON performance_alerts (created_at, resolved) WHERE resolved = FALSE;