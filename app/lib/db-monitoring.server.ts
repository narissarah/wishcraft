import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

/**
 * Database monitoring utilities for Neon
 * Helps maintain Built for Shopify performance requirements
 */

export async function getDatabaseMetrics() {
  try {
    // Get cache statistics from Neon
    const cacheStats = await db.$queryRaw`
      SELECT * FROM neon_stat_file_cache()
    ` as any[];
    
    // Get slow queries (requires pg_stat_statements extension)
    let slowQueries = [];
    try {
      slowQueries = await db.$queryRaw`
        SELECT 
          query,
          mean_exec_time,
          calls,
          total_exec_time,
          min_exec_time,
          max_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 10
      ` as any[];
    } catch (error) {
      // pg_stat_statements might not be enabled
      log.info("pg_stat_statements not available", { error });
    }
    
    return { cacheStats, slowQueries };
  } catch (error) {
    log.error("Failed to get database metrics", { error });
    return { cacheStats: [], slowQueries: [] };
  }
}

export async function getWorkingSetSize() {
  try {
    const result = await db.$queryRaw`
      SELECT 
        sum(heap_blks_read) as reads,
        sum(heap_blks_hit) as hits,
        sum(heap_blks_hit)::float / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0)::float as hit_rate
      FROM pg_statio_user_tables
    ` as any[];
    
    return result[0] || { reads: 0, hits: 0, hit_rate: 0 };
  } catch (error) {
    log.error("Failed to get working set size", { error });
    return { reads: 0, hits: 0, hit_rate: 0 };
  }
}

export async function getTableSizes() {
  try {
    const sizes = await db.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    ` as any[];
    
    return sizes;
  } catch (error) {
    log.error("Failed to get table sizes", { error });
    return [];
  }
}

export async function getConnectionStats() {
  try {
    const stats = await db.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) filter (where state = 'active') as active_connections,
        count(*) filter (where state = 'idle') as idle_connections,
        count(*) filter (where state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    ` as any[];
    
    return stats[0] || { 
      total_connections: 0, 
      active_connections: 0, 
      idle_connections: 0,
      idle_in_transaction: 0 
    };
  } catch (error) {
    log.error("Failed to get connection stats", { error });
    return { 
      total_connections: 0, 
      active_connections: 0, 
      idle_connections: 0,
      idle_in_transaction: 0 
    };
  }
}

/**
 * Check if database performance meets Built for Shopify requirements
 */
export async function checkPerformanceCompliance() {
  const metrics = await getDatabaseMetrics();
  const workingSet = await getWorkingSetSize();
  const connectionStats = await getConnectionStats();
  
  const issues = [];
  
  // Check cache hit rate (should be > 90% for good performance)
  if (workingSet.hit_rate < 0.9) {
    issues.push({
      severity: 'warning',
      message: `Cache hit rate is ${(workingSet.hit_rate * 100).toFixed(2)}% (should be > 90%)`,
      recommendation: 'Consider increasing compute size or optimizing queries'
    });
  }
  
  // Check for slow queries
  if (metrics.slowQueries.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Found ${metrics.slowQueries.length} slow queries (>100ms)`,
      recommendation: 'Review and optimize slow queries to improve performance'
    });
  }
  
  // Check connection usage
  if (connectionStats.idle_in_transaction > 5) {
    issues.push({
      severity: 'warning',
      message: `${connectionStats.idle_in_transaction} connections idle in transaction`,
      recommendation: 'Ensure transactions are properly committed or rolled back'
    });
  }
  
  return {
    compliant: issues.length === 0,
    issues,
    metrics: {
      cacheHitRate: workingSet.hit_rate,
      slowQueryCount: metrics.slowQueries.length,
      connectionStats
    }
  };
}

/**
 * Get performance metrics for the last 24 hours
 */
export async function getDailyPerformanceMetrics(shopId: string) {
  try {
    const metrics = await db.performance_metrics.findMany({
      where: {
        shopId,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    // Calculate aggregates
    const avgLCP = metrics.reduce((sum, m) => sum + (m.lcp || 0), 0) / metrics.length;
    const avgCLS = metrics.reduce((sum, m) => sum + (m.cls || 0), 0) / metrics.length;
    const avgINP = metrics.reduce((sum, m) => sum + (m.inp || 0), 0) / metrics.length;
    
    return {
      metrics,
      aggregates: {
        avgLCP,
        avgCLS,
        avgINP,
        count: metrics.length
      },
      compliant: avgLCP <= 2500 && avgCLS <= 0.1 && avgINP <= 200
    };
  } catch (error) {
    log.error("Failed to get daily performance metrics", { error });
    return {
      metrics: [],
      aggregates: { avgLCP: 0, avgCLS: 0, avgINP: 0, count: 0 },
      compliant: false
    };
  }
}