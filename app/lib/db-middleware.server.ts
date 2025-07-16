/**
 * Database Middleware for Performance Optimization
 * Built for Shopify 2025 Compliance
 */

import { Prisma } from "@prisma/client";
import { log } from "~/lib/logger.server";
import { getCircuitBreaker } from "~/lib/circuit-breaker.server";

// Query timeout middleware
export const queryTimeoutMiddleware: Prisma.Middleware = async (params, next) => {
  const timeout = parseInt(process.env.DATABASE_QUERY_TIMEOUT || "30000");
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query timeout after ${timeout}ms: ${params.model}.${params.action}`));
    }, timeout);
  });
  
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([next(params), timeoutPromise]);
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      log.warn("Slow database query", {
        model: params.model,
        action: params.action,
        duration,
        args: process.env.NODE_ENV === "development" ? params.args : undefined
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("Database query failed", {
      model: params.model,
      action: params.action,
      duration,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  }
};

// Circuit breaker middleware for database operations
export const circuitBreakerMiddleware: Prisma.Middleware = async (params, next) => {
  const circuitBreaker = getCircuitBreaker("database", {
    failureThreshold: 5,
    resetTimeout: 30000,
    requestTimeout: 60000,
    volumeThreshold: 10,
    errorThresholdPercentage: 50
  });
  
  return circuitBreaker.execute(() => next(params));
};

// Query batching middleware to reduce database load
class QueryBatcher {
  private batches = new Map<string, {
    queries: Array<{ params: any; resolve: Function; reject: Function }>;
    timer?: NodeJS.Timeout;
  }>();
  
  private readonly batchSize = 10;
  private readonly batchDelay = 10; // ms
  
  async batch(key: string, params: any, next: Function): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.batches.has(key)) {
        this.batches.set(key, { queries: [] });
      }
      
      const batch = this.batches.get(key)!;
      batch.queries.push({ params, resolve, reject });
      
      // If batch is full, execute immediately
      if (batch.queries.length >= this.batchSize) {
        this.executeBatch(key, next);
      } else if (!batch.timer) {
        // Otherwise, schedule execution
        batch.timer = setTimeout(() => {
          this.executeBatch(key, next);
        }, this.batchDelay);
      }
    });
  }
  
  private async executeBatch(key: string, next: Function) {
    const batch = this.batches.get(key);
    if (!batch || batch.queries.length === 0) return;
    
    this.batches.delete(key);
    
    if (batch.timer) {
      clearTimeout(batch.timer);
    }
    
    // Execute all queries in parallel
    const results = await Promise.allSettled(
      batch.queries.map(q => next(q.params))
    );
    
    // Resolve/reject individual promises
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        batch.queries[index].resolve(result.value);
      } else {
        batch.queries[index].reject(result.reason);
      }
    });
  }
}

const queryBatcher = new QueryBatcher();

export const batchingMiddleware: Prisma.Middleware = async (params, next) => {
  // Only batch findMany queries
  if (params.action === "findMany" && params.model) {
    const key = `${params.model}:findMany`;
    return queryBatcher.batch(key, params, next);
  }
  
  return next(params);
};

// Connection pool monitoring
export function setupConnectionPoolMonitoring(prisma: any) {
  if (process.env.NODE_ENV === "production") {
    setInterval(() => {
      // Get pool metrics from Prisma engine
      prisma.$metrics.json().then((metrics: any) => {
        const poolMetrics = metrics.counters.find((c: any) => 
          c.key === "prisma_client_queries_active"
        );
        
        if (poolMetrics && poolMetrics.value > 8) {
          log.warn("High database connection usage", {
            activeConnections: poolMetrics.value,
            maxConnections: process.env.DATABASE_POOL_MAX || 10
          });
        }
      }).catch((error: Error) => {
        log.error("Failed to get database metrics", { error: error.message });
      });
    }, 30000); // Check every 30 seconds
  }
}

// Query optimization suggestions
export function analyzeQuery(params: Prisma.MiddlewareParams): string[] {
  const suggestions: string[] = [];
  
  if (params.action === "findMany") {
    // Check for missing pagination
    if (!params.args?.take && !params.args?.cursor) {
      suggestions.push("Consider adding pagination with 'take' parameter");
    }
    
    // Check for missing select
    if (!params.args?.select && !params.args?.include) {
      suggestions.push("Consider using 'select' to fetch only needed fields");
    }
    
    // Check for large includes
    if (params.args?.include) {
      const includeCount = Object.keys(params.args.include).length;
      if (includeCount > 3) {
        suggestions.push(`Large include detected (${includeCount} relations). Consider splitting queries`);
      }
    }
  }
  
  return suggestions;
}

// Retry middleware for transient failures
export const retryMiddleware: Prisma.Middleware = async (params, next) => {
  const maxRetries = 3;
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await next(params);
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on transient errors
      const isTransient = 
        lastError.message.includes("Connection pool timeout") ||
        lastError.message.includes("Connection terminated") ||
        lastError.message.includes("Connection lost");
      
      if (!isTransient || attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      log.debug(`Retrying database operation (attempt ${attempt}/${maxRetries})`, {
        model: params.model,
        action: params.action
      });
    }
  }
  
  throw lastError;
};

// Export middleware configuration
export function configureDatabaseMiddleware(prisma: any) {
  // Apply middlewares in order
  prisma.$use(queryTimeoutMiddleware);
  prisma.$use(retryMiddleware);
  prisma.$use(circuitBreakerMiddleware);
  
  // Enable connection pool monitoring
  setupConnectionPoolMonitoring(prisma);
  
  log.info("Database middleware configured", {
    queryTimeout: process.env.DATABASE_QUERY_TIMEOUT || "30000",
    poolMax: process.env.DATABASE_POOL_MAX || "10"
  });
}