// Database Performance Monitoring System for WishCraft
// Comprehensive tracking of database queries, performance metrics, and health monitoring

import { logger } from './logger';
import { apmManager } from './apm-setup';
import { errorTracker } from './error-tracking';

// Database Operation Types
export enum DatabaseOperation {
  SELECT = 'select',
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  TRANSACTION = 'transaction',
  BULK_INSERT = 'bulk_insert',
  BULK_UPDATE = 'bulk_update',
  INDEX_SCAN = 'index_scan',
  FULL_TABLE_SCAN = 'full_table_scan'
}

// Database Table Categories
export enum TableCategory {
  USERS = 'users',
  REGISTRIES = 'registries',
  PRODUCTS = 'products',
  ORDERS = 'orders',
  ANALYTICS = 'analytics',
  SESSIONS = 'sessions',
  LOGS = 'logs',
  CACHE = 'cache',
  METADATA = 'metadata'
}

// Query Performance Metrics
export interface QueryMetrics {
  queryId: string;
  operation: DatabaseOperation;
  table: string;
  tableCategory: TableCategory;
  sql: string;
  sanitizedSQL: string;
  startTime: number;
  endTime: number;
  duration: number;
  rowsAffected: number;
  rowsExamined: number;
  success: boolean;
  error?: {
    code: string;
    message: string;
    severity: string;
  };
  performance: {
    cpuTime: number;
    ioWait: number;
    lockWait: number;
    indexUsage: boolean;
    cacheHit: boolean;
    queryPlan?: string;
  };
  metadata: {
    connectionId: string;
    userId?: string;
    shopId?: string;
    endpoint?: string;
    requestId?: string;
  };
}

// Connection Pool Metrics
export interface ConnectionPoolMetrics {
  poolName: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  connectionErrors: number;
  avgConnectionTime: number;
  avgQueryTime: number;
  totalQueries: number;
  failedQueries: number;
}

// Database Health Status
export enum DatabaseHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  MAINTENANCE = 'maintenance'
}

// Database Health Metrics
export interface DatabaseHealthMetrics {
  status: DatabaseHealthStatus;
  connections: ConnectionPoolMetrics;
  performance: {
    avgQueryTime: number;
    slowQueryCount: number;
    errorRate: number;
    throughput: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    ioUtilization: number;
  };
  replication: {
    lag: number;
    status: string;
  };
}

// Database Monitoring Configuration
export interface DatabaseConfig {
  performanceThresholds: {
    slowQuery: number; // 1000ms
    verySlowQuery: number; // 5000ms
    deadlockTimeout: number; // 30000ms
  };
  alertThresholds: {
    errorRate: number; // 5%
    connectionUtilization: number; // 80%
    replicationLag: number; // 60000ms (1 minute)
  };
  monitoring: {
    enabled: boolean;
    sampleRate: number; // 0.1 for 10% sampling
    logSlowQueries: boolean;
    explainSlowQueries: boolean;
  };
}

// Database Performance Monitor
export class DatabasePerformanceMonitor {
  private config: DatabaseConfig;
  private activeQueries: Map<string, QueryMetrics> = new Map();
  private queryHistory: QueryMetrics[] = [];
  private connectionPools: Map<string, ConnectionPoolMetrics> = new Map();
  private slowQueries: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Collect connection pool metrics every 30 seconds
    setInterval(() => {
      this.collectConnectionPoolMetrics();
    }, 30000);

    // Analyze slow queries every 5 minutes
    setInterval(() => {
      this.analyzeSlowQueries();
    }, 300000);

    // Clean up old metrics every 10 minutes
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 600000);

    // Send performance metrics every minute
    setInterval(() => {
      this.sendPerformanceMetrics();
    }, 60000);

    // Check database health every 2 minutes
    setInterval(() => {
      this.checkDatabaseHealth();
    }, 120000);

    logger.info('Database performance monitoring initialized');
  }

  // Start Query Tracking
  public startQuery(
    sql: string,
    operation: DatabaseOperation,
    table: string,
    metadata?: Partial<QueryMetrics['metadata']>
  ): string {
    const queryId = this.generateQueryId();
    const sanitizedSQL = this.sanitizeSQL(sql);

    const metrics: QueryMetrics = {
      queryId,
      operation,
      table,
      tableCategory: this.categorizeTable(table),
      sql,
      sanitizedSQL,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      rowsAffected: 0,
      rowsExamined: 0,
      success: false,
      performance: {
        cpuTime: 0,
        ioWait: 0,
        lockWait: 0,
        indexUsage: false,
        cacheHit: false
      },
      metadata: {
        connectionId: this.generateConnectionId(),
        ...metadata
      }
    };

    this.activeQueries.set(queryId, metrics);
    return queryId;
  }

  // Complete Query Tracking
  public completeQuery(
    queryId: string,
    result: {
      success: boolean;
      rowsAffected?: number;
      rowsExamined?: number;
      error?: Error;
      performance?: Partial<QueryMetrics['performance']>;
    }
  ): void {
    const metrics = this.activeQueries.get(queryId);
    if (!metrics) return;

    const endTime = Date.now();
    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;
    metrics.success = result.success;
    metrics.rowsAffected = result.rowsAffected || 0;
    metrics.rowsExamined = result.rowsExamined || 0;

    // Update performance metrics
    if (result.performance) {
      metrics.performance = { ...metrics.performance, ...result.performance };
    }

    // Handle errors
    if (result.error) {
      metrics.error = {
        code: (result.error as any).code || 'UNKNOWN',
        message: result.error.message,
        severity: this.determineErrorSeverity(result.error)
      };

      // Track error in error tracking system
      errorTracker.captureError(result.error, {
        queryId,
        operation: metrics.operation,
        table: metrics.table,
        duration: metrics.duration,
        sql: metrics.sanitizedSQL
      });
    }

    // Store completed query
    this.queryHistory.push(metrics);
    this.activeQueries.delete(queryId);

    // Update tracking metrics
    this.updateSlowQueryTracking(metrics);
    this.updateErrorTracking(metrics);

    // Send to APM
    this.sendToAPM(metrics);

    // Check for alerts
    this.checkQueryAlerts(metrics);

    // Log slow or failed queries
    if (!metrics.success || metrics.duration > this.config.performanceThresholds.slowQuery) {
      logger.warn('Database query issue', {
        queryId,
        operation: metrics.operation,
        table: metrics.table,
        duration: metrics.duration,
        success: metrics.success,
        rowsExamined: metrics.rowsExamined,
        error: metrics.error?.message
      });
    }
  }

  private sanitizeSQL(sql: string): string {
    // Remove literal values and replace with placeholders for grouping
    return sql
      .replace(/\$\d+/g, '$?') // PostgreSQL parameters
      .replace(/\?/g, '?') // Generic parameters
      .replace(/'[^']*'/g, "'?'") // String literals
      .replace(/\b\d+\b/g, '?') // Number literals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private categorizeTable(tableName: string): TableCategory {
    const table = tableName.toLowerCase();
    
    if (table.includes('user') || table.includes('customer')) return TableCategory.USERS;
    if (table.includes('registry') || table.includes('wishlist')) return TableCategory.REGISTRIES;
    if (table.includes('product') || table.includes('item')) return TableCategory.PRODUCTS;
    if (table.includes('order') || table.includes('purchase')) return TableCategory.ORDERS;
    if (table.includes('analytics') || table.includes('metric')) return TableCategory.ANALYTICS;
    if (table.includes('session')) return TableCategory.SESSIONS;
    if (table.includes('log') || table.includes('audit')) return TableCategory.LOGS;
    if (table.includes('cache')) return TableCategory.CACHE;
    
    return TableCategory.METADATA;
  }

  private determineErrorSeverity(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('deadlock') || message.includes('timeout')) return 'HIGH';
    if (message.includes('connection') || message.includes('network')) return 'MEDIUM';
    if (message.includes('syntax') || message.includes('constraint')) return 'LOW';
    
    return 'MEDIUM';
  }

  private updateSlowQueryTracking(metrics: QueryMetrics): void {
    if (metrics.duration > this.config.performanceThresholds.slowQuery) {
      const key = metrics.sanitizedSQL;
      this.slowQueries.set(key, (this.slowQueries.get(key) || 0) + 1);

      // Analyze query plan for very slow queries
      if (metrics.duration > this.config.performanceThresholds.verySlowQuery) {
        this.analyzeQueryPlan(metrics);
      }
    }
  }

  private updateErrorTracking(metrics: QueryMetrics): void {
    if (!metrics.success) {
      const key = `${metrics.operation}_${metrics.tableCategory}`;
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }
  }

  private async analyzeQueryPlan(metrics: QueryMetrics): Promise<void> {
    try {
      // This would integrate with your database to get query execution plans
      // For PostgreSQL: EXPLAIN ANALYZE
      // For MySQL: EXPLAIN FORMAT=JSON
      logger.info('Query plan analysis needed', {
        queryId: metrics.queryId,
        sanitizedSQL: metrics.sanitizedSQL,
        duration: metrics.duration
      });
    } catch (error) {
      logger.error('Failed to analyze query plan', { error, queryId: metrics.queryId });
    }
  }

  private sendToAPM(metrics: QueryMetrics): void {
    // Record timing metrics
    apmManager.recordTiming(
      `database.${metrics.operation}`,
      metrics.duration,
      {
        table: metrics.table,
        tableCategory: metrics.tableCategory,
        success: metrics.success,
        rowsAffected: metrics.rowsAffected
      }
    );

    // Record business metrics
    apmManager.recordBusinessMetric(
      'database.queries_total',
      1,
      [`operation:${metrics.operation}`, `table_category:${metrics.tableCategory}`, `success:${metrics.success}`]
    );

    apmManager.recordBusinessMetric(
      'database.rows_affected',
      metrics.rowsAffected,
      [`operation:${metrics.operation}`]
    );

    if (metrics.performance.indexUsage) {
      apmManager.recordBusinessMetric('database.index_usage', 1, [`table:${metrics.table}`]);
    }

    if (metrics.performance.cacheHit) {
      apmManager.recordBusinessMetric('database.cache_hits', 1, [`table:${metrics.table}`]);
    }
  }

  private checkQueryAlerts(metrics: QueryMetrics): void {
    // Check for very slow queries
    if (metrics.duration > this.config.performanceThresholds.verySlowQuery) {
      this.sendSlowQueryAlert(metrics, 'critical');
    } else if (metrics.duration > this.config.performanceThresholds.slowQuery) {
      this.sendSlowQueryAlert(metrics, 'warning');
    }

    // Check for full table scans on large tables
    if (metrics.operation === DatabaseOperation.FULL_TABLE_SCAN && 
        metrics.rowsExamined > 10000) {
      this.sendFullTableScanAlert(metrics);
    }

    // Check for high error rates
    this.checkErrorRateThreshold(metrics);
  }

  private sendSlowQueryAlert(metrics: QueryMetrics, severity: string): void {
    logger.warn('Slow database query detected', {
      severity,
      queryId: metrics.queryId,
      operation: metrics.operation,
      table: metrics.table,
      duration: metrics.duration,
      rowsExamined: metrics.rowsExamined,
      sanitizedSQL: metrics.sanitizedSQL
    });
  }

  private sendFullTableScanAlert(metrics: QueryMetrics): void {
    logger.warn('Full table scan detected', {
      queryId: metrics.queryId,
      table: metrics.table,
      rowsExamined: metrics.rowsExamined,
      duration: metrics.duration
    });
  }

  private checkErrorRateThreshold(metrics: QueryMetrics): void {
    const key = `${metrics.operation}_${metrics.tableCategory}`;
    const errors = this.errorCounts.get(key) || 0;
    const total = this.queryHistory
      .filter(q => q.operation === metrics.operation && q.tableCategory === metrics.tableCategory)
      .length;

    if (total >= 10) { // Only check after sufficient samples
      const errorRate = (errors / total) * 100;
      if (errorRate >= this.config.alertThresholds.errorRate) {
        this.sendErrorRateAlert(metrics, errorRate);
      }
    }
  }

  private sendErrorRateAlert(metrics: QueryMetrics, errorRate: number): void {
    logger.error('High database error rate detected', {
      operation: metrics.operation,
      tableCategory: metrics.tableCategory,
      errorRate,
      threshold: this.config.alertThresholds.errorRate
    });
  }

  private collectConnectionPoolMetrics(): void {
    // This would integrate with your actual connection pool
    // For now, simulating connection pool data
    const poolMetrics: ConnectionPoolMetrics = {
      poolName: 'main',
      totalConnections: 20,
      activeConnections: 8,
      idleConnections: 12,
      waitingConnections: 0,
      maxConnections: 20,
      connectionErrors: 0,
      avgConnectionTime: 50,
      avgQueryTime: 150,
      totalQueries: 1500,
      failedQueries: 12
    };

    this.connectionPools.set('main', poolMetrics);

    // Send metrics to APM
    apmManager.recordBusinessMetric('database.connections.total', poolMetrics.totalConnections);
    apmManager.recordBusinessMetric('database.connections.active', poolMetrics.activeConnections);
    apmManager.recordBusinessMetric('database.connections.idle', poolMetrics.idleConnections);
    apmManager.recordBusinessMetric('database.connections.waiting', poolMetrics.waitingConnections);

    // Check connection pool utilization
    const utilization = (poolMetrics.activeConnections / poolMetrics.maxConnections) * 100;
    if (utilization > this.config.alertThresholds.connectionUtilization) {
      this.sendConnectionPoolAlert(poolMetrics, utilization);
    }
  }

  private sendConnectionPoolAlert(metrics: ConnectionPoolMetrics, utilization: number): void {
    logger.warn('High database connection pool utilization', {
      poolName: metrics.poolName,
      utilization,
      activeConnections: metrics.activeConnections,
      maxConnections: metrics.maxConnections,
      waitingConnections: metrics.waitingConnections
    });
  }

  private analyzeSlowQueries(): void {
    const topSlowQueries = Array.from(this.slowQueries.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    for (const [sql, count] of topSlowQueries) {
      logger.info('Frequently slow query detected', {
        sanitizedSQL: sql,
        occurrences: count,
        recommendation: 'Consider adding indexes or optimizing query structure'
      });
    }

    // Reset slow query counts
    this.slowQueries.clear();
  }

  private checkDatabaseHealth(): void {
    const poolMetrics = this.connectionPools.get('main');
    if (!poolMetrics) return;

    const recentQueries = this.queryHistory.slice(-100); // Last 100 queries
    const errorRate = recentQueries.length > 0 
      ? (recentQueries.filter(q => !q.success).length / recentQueries.length) * 100 
      : 0;

    const avgQueryTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
      : 0;

    const slowQueryCount = recentQueries.filter(q => q.duration > this.config.performanceThresholds.slowQuery).length;

    let healthStatus = DatabaseHealthStatus.HEALTHY;

    if (errorRate > 20 || avgQueryTime > 5000 || slowQueryCount > 10) {
      healthStatus = DatabaseHealthStatus.CRITICAL;
    } else if (errorRate > 10 || avgQueryTime > 2000 || slowQueryCount > 5) {
      healthStatus = DatabaseHealthStatus.DEGRADED;
    }

    const healthMetrics: DatabaseHealthMetrics = {
      status: healthStatus,
      connections: poolMetrics,
      performance: {
        avgQueryTime,
        slowQueryCount,
        errorRate,
        throughput: recentQueries.length
      },
      resources: {
        cpuUsage: 0, // Would come from system monitoring
        memoryUsage: 0,
        diskUsage: 0,
        ioUtilization: 0
      },
      replication: {
        lag: 0, // Would come from replication monitoring
        status: 'healthy'
      }
    };

    // Record health metrics
    apmManager.recordBusinessMetric('database.health_score', this.getHealthScore(healthStatus));
    apmManager.recordBusinessMetric('database.error_rate', errorRate);
    apmManager.recordBusinessMetric('database.avg_query_time', avgQueryTime);
    apmManager.recordBusinessMetric('database.slow_query_count', slowQueryCount);

    if (healthStatus !== DatabaseHealthStatus.HEALTHY) {
      logger.warn('Database health degraded', {
        status: healthStatus,
        errorRate,
        avgQueryTime,
        slowQueryCount,
        connectionUtilization: (poolMetrics.activeConnections / poolMetrics.maxConnections) * 100
      });
    }
  }

  private getHealthScore(status: DatabaseHealthStatus): number {
    switch (status) {
      case DatabaseHealthStatus.HEALTHY: return 100;
      case DatabaseHealthStatus.DEGRADED: return 60;
      case DatabaseHealthStatus.CRITICAL: return 20;
      case DatabaseHealthStatus.MAINTENANCE: return 0;
      default: return 50;
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago

    // Keep only recent query history
    this.queryHistory = this.queryHistory.filter(q => q.endTime > cutoff);

    // Reset error counts
    this.errorCounts.clear();

    logger.info('Database metrics cleanup completed');
  }

  private sendPerformanceMetrics(): void {
    const recentQueries = this.queryHistory.slice(-1000); // Last 1000 queries
    if (recentQueries.length === 0) return;

    // Group by operation and calculate metrics
    const operationMetrics = recentQueries.reduce((acc, query) => {
      const key = query.operation;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(query.duration);
      return acc;
    }, {} as Record<string, number[]>);

    for (const [operation, durations] of Object.entries(operationMetrics)) {
      const sorted = durations.sort((a, b) => a - b);
      const p50 = this.percentile(sorted, 0.5);
      const p95 = this.percentile(sorted, 0.95);
      const p99 = this.percentile(sorted, 0.99);
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;

      apmManager.recordBusinessMetric(`database.${operation}.p50`, p50);
      apmManager.recordBusinessMetric(`database.${operation}.p95`, p95);
      apmManager.recordBusinessMetric(`database.${operation}.p99`, p99);
      apmManager.recordBusinessMetric(`database.${operation}.avg`, avg);
    }
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[index] || 0;
  }

  private generateQueryId(): string {
    return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Public API for getting metrics
  public getDatabaseMetrics(): any {
    const recentQueries = this.queryHistory.slice(-100);
    const connectionMetrics = this.connectionPools.get('main');

    const totalQueries = recentQueries.length;
    const successfulQueries = recentQueries.filter(q => q.success).length;
    const errorRate = totalQueries > 0 ? ((totalQueries - successfulQueries) / totalQueries) * 100 : 0;

    const avgDuration = totalQueries > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0;

    const slowQueries = recentQueries.filter(q => q.duration > this.config.performanceThresholds.slowQuery).length;

    const queriesByOperation = recentQueries.reduce((acc, query) => {
      acc[query.operation] = (acc[query.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalQueries,
      successfulQueries,
      errorRate,
      avgDuration,
      slowQueries,
      queriesByOperation,
      connectionPool: connectionMetrics,
      healthStatus: this.getDatabaseHealth()
    };
  }

  public getDatabaseHealth(): DatabaseHealthStatus {
    const recentQueries = this.queryHistory.slice(-50);
    if (recentQueries.length === 0) return DatabaseHealthStatus.HEALTHY;

    const errorRate = (recentQueries.filter(q => !q.success).length / recentQueries.length) * 100;
    const avgQueryTime = recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length;
    const slowQueryCount = recentQueries.filter(q => q.duration > this.config.performanceThresholds.slowQuery).length;

    if (errorRate > 20 || avgQueryTime > 5000 || slowQueryCount > 10) {
      return DatabaseHealthStatus.CRITICAL;
    } else if (errorRate > 10 || avgQueryTime > 2000 || slowQueryCount > 5) {
      return DatabaseHealthStatus.DEGRADED;
    }

    return DatabaseHealthStatus.HEALTHY;
  }

  public getSlowQueries(limit: number = 10): Array<{sql: string; count: number}> {
    return Array.from(this.slowQueries.entries())
      .map(([sql, count]) => ({ sql, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

// Prisma Middleware for Database Monitoring
export function createDatabaseMiddleware(monitor: DatabasePerformanceMonitor) {
  return async (params: any, next: any) => {
    const operation = params.action.toUpperCase() as DatabaseOperation;
    const table = params.model || 'unknown';
    
    const queryId = monitor.startQuery(
      JSON.stringify(params),
      operation,
      table,
      {
        requestId: params.runInTransaction ? 'transaction' : undefined
      }
    );

    try {
      const result = await next(params);
      
      monitor.completeQuery(queryId, {
        success: true,
        rowsAffected: Array.isArray(result) ? result.length : 1,
        performance: {
          indexUsage: true, // Prisma generally uses indexes
          cacheHit: false // Would need cache integration
        }
      });

      return result;
    } catch (error) {
      monitor.completeQuery(queryId, {
        success: false,
        error: error as Error
      });

      throw error;
    }
  };
}

// Configuration Factory
export function createDatabaseConfig(): DatabaseConfig {
  return {
    performanceThresholds: {
      slowQuery: 1000, // 1 second
      verySlowQuery: 5000, // 5 seconds
      deadlockTimeout: 30000 // 30 seconds
    },
    alertThresholds: {
      errorRate: 5, // 5%
      connectionUtilization: 80, // 80%
      replicationLag: 60000 // 1 minute
    },
    monitoring: {
      enabled: true,
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      logSlowQueries: true,
      explainSlowQueries: process.env.NODE_ENV !== 'production'
    }
  };
}

// Export singleton instance
export const databaseConfig = createDatabaseConfig();
export const databaseMonitor = new DatabasePerformanceMonitor(databaseConfig);