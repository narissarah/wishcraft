/**
 * Database Utilities - Common database operations and health checks
 * Provides consistent database connectivity and utility functions
 */

import { db } from './db.server';
import { log } from '~/lib/logger.server';

/**
 * Check database connection health
 */
export async function checkDatabaseConnection(): Promise<{
  isConnected: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await db.$queryRaw`SELECT 1`;
    return {
      isConnected: true,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      isConnected: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalTables: number;
  totalConnections: number;
  databaseSize: string;
  error?: string;
}> {
  try {
    const [tableCount, connectionCount, dbSize] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`,
      db.$queryRaw`SELECT COUNT(*) as count FROM pg_stat_activity`,
      db.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    ]);

    return {
      totalTables: Number((tableCount as any)[0]?.count || 0),
      totalConnections: Number((connectionCount as any)[0]?.count || 0),
      databaseSize: (dbSize as any)[0]?.size || 'Unknown'
    };
  } catch (error) {
    return {
      totalTables: 0,
      totalConnections: 0,
      databaseSize: 'Unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if database migration is needed
 */
export async function checkMigrationStatus(): Promise<{
  isUpToDate: boolean;
  pendingMigrations: number;
  error?: string;
}> {
  try {
    // Check if _prisma_migrations table exists
    const migrationTable = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      )
    `;

    if (!(migrationTable as any)[0]?.exists) {
      return {
        isUpToDate: false,
        pendingMigrations: 0,
        error: 'Migration table not found'
      };
    }

    // Check for failed migrations
    const failedMigrations = await db.$queryRaw`
      SELECT COUNT(*) as count FROM _prisma_migrations 
      WHERE finished_at IS NULL
    `;

    const pendingCount = Number((failedMigrations as any)[0]?.count || 0);

    return {
      isUpToDate: pendingCount === 0,
      pendingMigrations: pendingCount
    };
  } catch (error) {
    return {
      isUpToDate: false,
      pendingMigrations: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Safely execute database transaction
 */
export async function safeTransaction<T>(
  fn: (tx: Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }> {
  try {
    const result = await db.$transaction(fn);
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed'
    };
  }
}

/**
 * Get table row counts for monitoring
 */
export async function getTableCounts(): Promise<Record<string, number>> {
  try {
    const [
      sessionCount,
      shopCount,
      registryCount,
      registryItemCount,
      registryPurchaseCount,
      auditLogCount,
      systemJobCount,
      performanceMetricsCount
    ] = await Promise.all([
      db.session.count(),
      db.shop.count(),
      db.registry.count(),
      db.registryItem.count(),
      db.registryPurchase.count(),
      db.auditLog.count(),
      db.systemJob.count(),
      db.performanceMetrics.count()
    ]);

    return {
      sessions: sessionCount,
      shops: shopCount,
      registries: registryCount,
      registryItems: registryItemCount,
      registryPurchases: registryPurchaseCount,
      auditLogs: auditLogCount,
      systemJobs: systemJobCount,
      performanceMetrics: performanceMetricsCount
    };
  } catch (error) {
    log.error('Failed to get table counts', error as Error);
    return {};
  }
}

/**
 * Clean up old records based on retention policies
 */
export async function cleanupOldRecords(retentionDays: number = 90): Promise<{
  cleaned: number;
  error?: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    return { cleaned: result.count };
  } catch (error) {
    return {
      cleaned: 0,
      error: error instanceof Error ? error.message : 'Cleanup failed'
    };
  }
}