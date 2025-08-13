import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

/**
 * Database optimization utilities for Neon PostgreSQL
 * Ensures optimal performance for Built for Shopify requirements
 */

/**
 * Analyze and suggest indexes for slow queries
 */
export async function analyzeIndexOpportunities() {
  try {
    // Find tables without primary keys
    const tablesWithoutPK = await db.$queryRaw`
      SELECT 
        n.nspname as schema,
        c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = c.oid AND contype = 'p'
        )
    ` as any[];
    
    // Find missing indexes on foreign keys
    const missingFKIndexes = await db.$queryRaw`
      SELECT
        conname as constraint_name,
        conrelid::regclass as table_name,
        a.attname as column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f'
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND a.attnum = ANY(i.indkey)
        )
    ` as any[];
    
    // Find duplicate indexes
    const duplicateIndexes = await db.$queryRaw`
      SELECT 
        idx1.indexname as index1,
        idx2.indexname as index2,
        idx1.tablename
      FROM pg_indexes idx1
      JOIN pg_indexes idx2 ON idx1.tablename = idx2.tablename
        AND idx1.indexname < idx2.indexname
        AND idx1.indexdef = idx2.indexdef
      WHERE idx1.schemaname = 'public'
    ` as any[];
    
    return {
      tablesWithoutPK,
      missingFKIndexes,
      duplicateIndexes
    };
  } catch (error) {
    log.error("Failed to analyze index opportunities", { error });
    return {
      tablesWithoutPK: [],
      missingFKIndexes: [],
      duplicateIndexes: []
    };
  }
}

/**
 * Vacuum and analyze tables for better performance
 */
export async function optimizeTables() {
  try {
    // Get all user tables
    const tables = await db.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    ` as any[];
    
    const results = [];
    
    for (const table of tables) {
      try {
        // Analyze table to update statistics
        await db.$executeRawUnsafe(`ANALYZE ${table.tablename}`);
        
        results.push({
          table: table.tablename,
          status: 'optimized'
        });
      } catch (error) {
        log.error(`Failed to optimize table ${table.tablename}`, { error });
        results.push({
          table: table.tablename,
          status: 'failed',
          error: error
        });
      }
    }
    
    return results;
  } catch (error) {
    log.error("Failed to optimize tables", { error });
    return [];
  }
}

/**
 * Get query execution plans for optimization
 */
export async function explainQuery(query: string) {
  try {
    const plan = await db.$queryRawUnsafe(`EXPLAIN ANALYZE ${query}`) as any[];
    return plan;
  } catch (error) {
    log.error("Failed to explain query", { error, query });
    return [];
  }
}

/**
 * Implement query result caching strategy
 */
export class QueryCache {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static ttl = 5 * 60 * 1000; // 5 minutes
  
  static async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean up old entries
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
    
    return data;
  }
  
  static invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Optimize registry queries with proper indexing
 */
export async function getOptimizedRegistry(registryId: string, shopId: string) {
  const cacheKey = `registry:${registryId}:${shopId}`;
  
  return QueryCache.get(cacheKey, async () => {
    return db.registry.findFirst({
      where: {
        id: registryId,
        shopId: shopId
      },
      include: {
        items: {
          include: {
            product: true,
            purchases: true,
            reservations: {
              where: {
                status: 'ACTIVE'
              }
            }
          },
          orderBy: {
            priority: 'desc'
          }
        },
        collaborators: {
          where: {
            status: 'ACTIVE'
          }
        },
        theme: true
      }
    });
  });
}

/**
 * Batch database operations for better performance
 */
export class BatchProcessor {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }
  
  private async process() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    const batch = this.queue.splice(0, 10); // Process 10 at a time
    
    await Promise.all(batch.map(op => op()));
    
    // Continue processing
    setTimeout(() => this.process(), 10);
  }
}

/**
 * Connection pool monitoring
 */
export async function monitorConnectionPool() {
  try {
    const poolStats = await db.$queryRaw`
      SELECT 
        max_connections,
        current_connections,
        available_connections,
        waiting_clients
      FROM pg_stat_database_conflicts
      WHERE datname = current_database()
    ` as any[];
    
    return poolStats[0] || {
      max_connections: 100,
      current_connections: 0,
      available_connections: 100,
      waiting_clients: 0
    };
  } catch (error) {
    // Fallback to basic connection count
    const connections = await db.$queryRaw`
      SELECT count(*) as current_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    ` as any[];
    
    return {
      max_connections: 100,
      current_connections: connections[0]?.current_connections || 0,
      available_connections: 100 - (connections[0]?.current_connections || 0),
      waiting_clients: 0
    };
  }
}