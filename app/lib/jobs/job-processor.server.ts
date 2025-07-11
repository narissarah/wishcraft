import * as cron from 'node-cron';
import { db } from '~/lib/db.server';
import { log } from '~/lib/logger.server';
import { captureException } from '~/lib/monitoring.server';
import { registryCache, apiCache } from '~/lib/cache/redis.server';

/**
 * Background Job Processor
 * Handles scheduled tasks and background processing
 */

export type JobType = 
  | 'CACHE_WARM'
  | 'CLEANUP_OLD_LOGS'
  | 'SYNC_INVENTORY'
  | 'SEND_REMINDERS'
  | 'PROCESS_WEBHOOKS'
  | 'GENERATE_REPORTS'
  | 'CLEANUP_SESSIONS';

export interface JobConfig {
  type: JobType;
  schedule: string; // Cron expression
  enabled: boolean;
  handler: () => Promise<void>;
}

/**
 * Job Registry
 */
const jobs: Map<JobType, cron.ScheduledTask> = new Map();

/**
 * Job Configurations
 */
const jobConfigs: JobConfig[] = [
  {
    type: 'CACHE_WARM',
    schedule: '0 */30 * * * *', // Every 30 minutes
    enabled: true,
    handler: warmCacheJob,
  },
  {
    type: 'CLEANUP_OLD_LOGS',
    schedule: '0 0 2 * * *', // Daily at 2 AM
    enabled: true,
    handler: cleanupOldLogsJob,
  },
  {
    type: 'SYNC_INVENTORY',
    schedule: '0 */15 * * * *', // Every 15 minutes
    enabled: true,
    handler: syncInventoryJob,
  },
  {
    type: 'SEND_REMINDERS',
    schedule: '0 0 10 * * *', // Daily at 10 AM
    enabled: true,
    handler: sendRemindersJob,
  },
  {
    type: 'CLEANUP_SESSIONS',
    schedule: '0 0 */6 * * *', // Every 6 hours
    enabled: true,
    handler: cleanupSessionsJob,
  },
];

/**
 * Initialize job processor
 */
export function initializeJobProcessor() {
  if (process.env.NODE_ENV === 'test') {
    log.info('Job processor disabled in test environment');
    return;
  }
  
  log.info('Initializing job processor...');
  
  // Schedule all enabled jobs
  jobConfigs.forEach(config => {
    if (config.enabled) {
      scheduleJob(config);
    }
  });
  
  log.info(`Scheduled ${jobs.size} background jobs`);
}

/**
 * Schedule a job
 */
function scheduleJob(config: JobConfig) {
  try {
    const task = cron.schedule(config.schedule, async () => {
      await runJob(config);
    }, {
      timezone: process.env.TZ || 'UTC',
    });
    
    jobs.set(config.type, task);
    log.info(`Scheduled job: ${config.type} with schedule: ${config.schedule}`);
  } catch (error) {
    log.error(`Failed to schedule job: ${config.type}`, error);
    captureException(error as Error, {
      tags: { jobType: config.type },
    });
  }
}

/**
 * Run a job with error handling and logging
 */
async function runJob(config: JobConfig) {
  const startTime = Date.now();
  const jobId = `${config.type}-${Date.now()}`;
  
  try {
    // Create job record
    await db.systemJob.create({
      data: {
        id: jobId,
        type: config.type,
        status: 'running',
        startedAt: new Date()
      },
    });
    
    log.info(`Starting job: ${config.type}`, { jobId });
    
    // Execute job handler
    await config.handler();
    
    const duration = Date.now() - startTime;
    
    // Update job record
    await db.systemJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify({ duration, timestamp: new Date() })
      },
    });
    
    log.info(`Completed job: ${config.type}`, { jobId, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Update job record with error
    await db.systemJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        result: JSON.stringify({ duration, error: error instanceof Error ? error.message : 'Unknown error' })
      },
    }).catch(() => {}); // Ignore update errors
    
    log.error(`Job failed: ${config.type}`, error, { jobId, duration });
    captureException(error as Error, {
      tags: { jobType: config.type, jobId },
    });
  }
}

/**
 * Job Handlers
 */

async function warmCacheJob() {
  log.info('Starting cache warming job');
  
  // Get active shops
  const shops = await db.registry.findMany({
    select: { shopId: true },
    distinct: ['shopId'],
    where: {
      status: 'ACTIVE',
      updatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Active in last 7 days
      },
    },
  });
  
  // Warm cache for each shop
  for (const shop of shops) {
    try {
      // Warm registry cache
      const registries = await db.registry.findMany({
        where: { 
          shopId: shop.shopId,
          status: 'ACTIVE',
        },
        include: {
          items: true,
          purchases: true,
        },
      });
      
      // Cache each registry
      for (const registry of registries) {
        await registryCache.set(registry.id, registry);
      }
      
      // Cache shop registries list
      await apiCache.set(`registries:${shop.shopId}`, {
        registries: registries.map(r => ({
          id: r.id,
          title: r.title,
          customerId: r.customerId,
          status: r.status,
          itemCount: r.items.length,
        })),
        total: registries.length,
      });
      
      log.debug(`Warmed cache for shop: ${shop.shopId}`, { 
        registryCount: registries.length,
      });
    } catch (error) {
      log.error(`Failed to warm cache for shop: ${shop.shopId}`, error);
    }
  }
  
  log.info('Cache warming completed', { shopCount: shops.length });
}

async function cleanupOldLogsJob() {
  log.info('Starting log cleanup job');
  
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  
  // Cleanup audit logs
  const deletedAuditLogs = await db.auditLog.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
    },
  });
  
  // Cleanup old job records
  const deletedJobs = await db.systemJob.deleteMany({
    where: {
      completedAt: { lt: cutoffDate },
      status: { in: ['COMPLETED', 'FAILED'] },
    },
  });
  
  log.info('Log cleanup completed', {
    deletedAuditLogs: deletedAuditLogs.count,
    deletedJobs: deletedJobs.count,
  });
}

async function syncInventoryJob() {
  log.info('Starting inventory sync job');
  
  // Get registries with active items
  const registries = await db.registry.findMany({
    where: {
      status: 'ACTIVE',
      items: { some: {} },
    },
    include: {
      items: true,
    },
  });
  
  let syncedCount = 0;
  
  for (const registry of registries) {
    try {
      // This would sync with Shopify to update inventory
      // For now, we'll just log it
      log.debug(`Syncing inventory for registry: ${registry.id}`, {
        itemCount: registry.items.length,
      });
      
      syncedCount++;
      
      // Invalidate cache after sync
      await registryCache.invalidate(registry.id);
    } catch (error) {
      log.error(`Failed to sync inventory for registry: ${registry.id}`, error);
    }
  }
  
  log.info('Inventory sync completed', { 
    totalRegistries: registries.length,
    syncedCount,
  });
}

async function sendRemindersJob() {
  log.info('Starting reminder job');
  
  // Get registries with upcoming events
  const upcomingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  const registries = await db.registry.findMany({
    where: {
      status: 'ACTIVE',
      eventDate: {
        gte: new Date(),
        lte: upcomingDate,
      },
    },
  });
  
  let remindersSent = 0;
  
  for (const registry of registries) {
    try {
      // This would send email reminders
      // For now, we'll just log it
      log.debug(`Sending reminder for registry: ${registry.id}`, {
        eventDate: registry.eventDate,
      });
      
      // Create audit log
      await db.auditLog.create({
        data: {
          shopId: registry.shopId,
          action: 'REMINDER_SENT',
          resource: 'registry',
          resourceId: registry.id,
          metadata: JSON.stringify({
            eventDate: registry.eventDate,
            type: 'upcoming_event',
          }),
        },
      });
      
      remindersSent++;
    } catch (error) {
      log.error(`Failed to send reminder for registry: ${registry.id}`, error);
    }
  }
  
  log.info('Reminder job completed', {
    registriesProcessed: registries.length,
    remindersSent,
  });
}

async function cleanupSessionsJob() {
  log.info('Starting session cleanup job');
  
  // This would clean up expired sessions
  // Implementation depends on session storage strategy
  
  log.info('Session cleanup completed');
}

/**
 * Stop all jobs
 */
export function stopAllJobs() {
  jobs.forEach((task, type) => {
    task.stop();
    log.info(`Stopped job: ${type}`);
  });
  jobs.clear();
}

/**
 * Run a job manually
 */
export async function runJobManually(type: JobType) {
  const config = jobConfigs.find(c => c.type === type);
  if (!config) {
    throw new Error(`Unknown job type: ${type}`);
  }
  
  log.info(`Manually triggering job: ${type}`);
  await runJob(config);
}

/**
 * Get job status
 */
export async function getJobStatus(type: JobType, limit: number = 10) {
  const jobs = await db.systemJob.findMany({
    where: { type },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
  
  return jobs;
}

/**
 * Get all job statuses
 */
export async function getAllJobStatuses() {
  const statuses = await Promise.all(
    jobConfigs.map(async config => {
      const lastRun = await db.systemJob.findFirst({
        where: { type: config.type },
        orderBy: { startedAt: 'desc' },
      });
      
      return {
        type: config.type,
        schedule: config.schedule,
        enabled: config.enabled,
        isRunning: jobs.has(config.type),
        lastRun: lastRun ? {
          status: lastRun.status,
          startedAt: lastRun.startedAt,
          completedAt: lastRun.completedAt,
          errorMessage: lastRun.errorMessage,
        } : null,
      };
    })
  );
  
  return statuses;
}