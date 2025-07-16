/**
 * Audit Log Retention Management
 * Implements GDPR-compliant data retention policies
 */

import { db } from '~/lib/db.server';
import { log } from '~/lib/logger.server';
import { cache, cacheKeys } from '~/lib/cache-unified.server';

/**
 * Default retention periods (in days)
 */
export const RETENTION_PERIODS = {
  AUDIT_LOGS: 365,           // 1 year for audit logs
  PERFORMANCE_METRICS: 90,   // 90 days for performance metrics
  SYSTEM_JOBS: 30,           // 30 days for completed jobs
  REGISTRY_ACTIVITIES: 180,  // 180 days for registry activities
  SESSIONS: 90,              // 90 days for expired sessions
} as const;

/**
 * Clean up old audit logs based on retention policy
 */
export async function cleanupAuditLogs(shopId: string, retentionDays?: number): Promise<number> {
  const days = retentionDays || RETENTION_PERIODS.AUDIT_LOGS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  try {
    log.info('Starting audit log cleanup', { shopId, retentionDays: days, cutoffDate });
    
    // Delete old audit logs
    const result = await db.auditLog.deleteMany({
      where: {
        shopId,
        timestamp: {
          lt: cutoffDate
        }
      }
    });
    
    log.info('Audit log cleanup completed', { 
      shopId, 
      deletedCount: result.count,
      retentionDays: days 
    });
    
    // Log the cleanup action itself
    await db.auditLog.create({
      data: {
        shopId,
        action: 'audit_log_cleanup',
        resource: 'audit_logs',
        resourceId: 'batch',
        metadata: JSON.stringify({
          deletedCount: result.count,
          retentionDays: days,
          cutoffDate: cutoffDate.toISOString()
        })
      }
    });
    
    return result.count;
  } catch (error) {
    log.error('Audit log cleanup failed', error as Error);
    throw error;
  }
}

/**
 * Clean up old performance metrics
 */
export async function cleanupPerformanceMetrics(shopId: string, retentionDays?: number): Promise<number> {
  const days = retentionDays || RETENTION_PERIODS.PERFORMANCE_METRICS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  try {
    log.info('Starting performance metrics cleanup', { shopId, retentionDays: days, cutoffDate });
    
    const result = await db.performanceMetrics.deleteMany({
      where: {
        shopId,
        createdAt: {
          lt: cutoffDate
        }
      }
    });
    
    log.info('Performance metrics cleanup completed', { 
      shopId, 
      deletedCount: result.count,
      retentionDays: days 
    });
    
    return result.count;
  } catch (error) {
    log.error('Performance metrics cleanup failed', error as Error);
    throw error;
  }
}

/**
 * Clean up completed system jobs
 */
export async function cleanupSystemJobs(shopId: string, retentionDays?: number): Promise<number> {
  const days = retentionDays || RETENTION_PERIODS.SYSTEM_JOBS;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  try {
    log.info('Starting system jobs cleanup', { shopId, retentionDays: days, cutoffDate });
    
    const result = await db.systemJob.deleteMany({
      where: {
        shopId,
        status: {
          in: ['completed', 'failed', 'cancelled']
        },
        completedAt: {
          not: null,
          lt: cutoffDate
        }
      }
    });
    
    log.info('System jobs cleanup completed', { 
      shopId, 
      deletedCount: result.count,
      retentionDays: days 
    });
    
    return result.count;
  } catch (error) {
    log.error('System jobs cleanup failed', error as Error);
    throw error;
  }
}

/**
 * Clean up old registry activities
 */
export async function cleanupRegistryActivities(shopId: string, retentionDays?: number): Promise<number> {
  const days = retentionDays || RETENTION_PERIODS.REGISTRY_ACTIVITIES;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  try {
    log.info('Starting registry activities cleanup', { shopId, retentionDays: days, cutoffDate });
    
    // Get registries for this shop to clean their activities
    const registries = await db.registry.findMany({
      where: { shopId },
      select: { id: true }
    });
    
    const registryIds = registries.map(r => r.id);
    
    const result = await db.registryActivity.deleteMany({
      where: {
        registryId: {
          in: registryIds
        },
        createdAt: {
          lt: cutoffDate
        },
        // Keep important activities longer
        action: {
          notIn: ['registry_created', 'registry_deleted', 'item_purchased']
        }
      }
    });
    
    log.info('Registry activities cleanup completed', { 
      shopId, 
      deletedCount: result.count,
      retentionDays: days 
    });
    
    // Invalidate activity cache for affected registries
    await Promise.all(
      registryIds.map(id => cache.delete(cacheKeys.activity(id)))
    );
    
    return result.count;
  } catch (error) {
    log.error('Registry activities cleanup failed', error as Error);
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(shopId: string): Promise<number> {
  try {
    log.info('Starting expired sessions cleanup', { shopId });
    
    const result = await db.session.deleteMany({
      where: {
        shopId,
        expires: {
          not: null,
          lt: new Date()
        }
      }
    });
    
    log.info('Expired sessions cleanup completed', { 
      shopId, 
      deletedCount: result.count 
    });
    
    return result.count;
  } catch (error) {
    log.error('Expired sessions cleanup failed', error as Error);
    throw error;
  }
}

/**
 * Run comprehensive data retention cleanup for a shop
 */
export async function runDataRetentionCleanup(shopId: string): Promise<{
  auditLogs: number;
  performanceMetrics: number;
  systemJobs: number;
  registryActivities: number;
  sessions: number;
  total: number;
}> {
  try {
    log.info('Starting comprehensive data retention cleanup', { shopId });
    
    // Get shop's custom retention settings if any
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { dataRetentionPeriod: true }
    });
    
    const customRetentionDays = shop?.dataRetentionPeriod;
    
    // Run all cleanups in parallel
    const [auditLogs, performanceMetrics, systemJobs, registryActivities, sessions] = await Promise.all([
      cleanupAuditLogs(shopId, customRetentionDays),
      cleanupPerformanceMetrics(shopId),
      cleanupSystemJobs(shopId),
      cleanupRegistryActivities(shopId),
      cleanupExpiredSessions(shopId)
    ]);
    
    const total = auditLogs + performanceMetrics + systemJobs + registryActivities + sessions;
    
    // Update last cleanup timestamp
    await db.shop.update({
      where: { id: shopId },
      data: { lastDataCleanup: new Date() }
    });
    
    // Create cleanup job record
    await db.systemJob.create({
      data: {
        shopId,
        type: 'data_retention_cleanup',
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify({
          auditLogs,
          performanceMetrics,
          systemJobs,
          registryActivities,
          sessions,
          total
        })
      }
    });
    
    log.info('Data retention cleanup completed', { 
      shopId, 
      results: { auditLogs, performanceMetrics, systemJobs, registryActivities, sessions, total }
    });
    
    return { auditLogs, performanceMetrics, systemJobs, registryActivities, sessions, total };
    
  } catch (error) {
    log.error('Data retention cleanup failed', error as Error);
    
    // Record failure
    await db.systemJob.create({
      data: {
        shopId,
        type: 'data_retention_cleanup',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      }
    });
    
    throw error;
  }
}

/**
 * Schedule periodic cleanup for all shops
 */
export async function scheduleDataRetentionCleanup(): Promise<void> {
  try {
    log.info('Scheduling data retention cleanup for all shops');
    
    // Get all shops that need cleanup (haven't been cleaned in 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    const shops = await db.shop.findMany({
      where: {
        OR: [
          { lastDataCleanup: null },
          { lastDataCleanup: { lt: cutoffDate } }
        ]
      },
      select: { id: true }
    });
    
    log.info(`Found ${shops.length} shops needing data retention cleanup`);
    
    // Schedule cleanup jobs
    for (const shop of shops) {
      await db.systemJob.create({
        data: {
          shopId: shop.id,
          type: 'data_retention_cleanup',
          status: 'pending',
          priority: 3, // Low priority
          runAt: new Date(Date.now() + Math.random() * 3600000) // Spread over 1 hour
        }
      });
    }
    
    log.info('Data retention cleanup jobs scheduled');
    
  } catch (error) {
    log.error('Failed to schedule data retention cleanup', error as Error);
    throw error;
  }
}

/**
 * Get retention statistics for a shop
 */
export async function getRetentionStatistics(shopId: string): Promise<{
  auditLogs: { total: number; oldestRecord: Date | null };
  performanceMetrics: { total: number; oldestRecord: Date | null };
  systemJobs: { total: number; oldestRecord: Date | null };
  registryActivities: { total: number; oldestRecord: Date | null };
  sessions: { total: number; expired: number };
  lastCleanup: Date | null;
}> {
  try {
    const [
      auditLogStats,
      performanceStats,
      jobStats,
      activityStats,
      sessionStats,
      shop
    ] = await Promise.all([
      // Audit logs
      db.auditLog.aggregate({
        where: { shopId },
        _count: true,
        _min: { timestamp: true }
      }),
      
      // Performance metrics
      db.performanceMetrics.aggregate({
        where: { shopId },
        _count: true,
        _min: { createdAt: true }
      }),
      
      // System jobs
      db.systemJob.aggregate({
        where: { shopId },
        _count: true,
        _min: { createdAt: true }
      }),
      
      // Registry activities
      db.registryActivity.aggregate({
        where: { registry: { shopId } },
        _count: true,
        _min: { createdAt: true }
      }),
      
      // Sessions
      Promise.all([
        db.session.count({ where: { shopId } }),
        db.session.count({ 
          where: { 
            shopId,
            expires: { not: null, lt: new Date() }
          } 
        })
      ]),
      
      // Shop info
      db.shop.findUnique({
        where: { id: shopId },
        select: { lastDataCleanup: true }
      })
    ]);
    
    return {
      auditLogs: {
        total: auditLogStats._count,
        oldestRecord: auditLogStats._min.timestamp
      },
      performanceMetrics: {
        total: performanceStats._count,
        oldestRecord: performanceStats._min.createdAt
      },
      systemJobs: {
        total: jobStats._count,
        oldestRecord: jobStats._min.createdAt
      },
      registryActivities: {
        total: activityStats._count,
        oldestRecord: activityStats._min.createdAt
      },
      sessions: {
        total: sessionStats[0],
        expired: sessionStats[1]
      },
      lastCleanup: shop?.lastDataCleanup || null
    };
    
  } catch (error) {
    log.error('Failed to get retention statistics', error as Error);
    throw error;
  }
}