// System Job Processor for Background Tasks
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { handleCustomerDataRequest, handleCustomerRedactRequest, handleShopRedactRequest } from "~/lib/built-for-shopify.server";
import { runDataRetentionCleanup } from "~/lib/audit-log-retention.server";

// SystemJob interface moved to Prisma schema

/**
 * Process pending system jobs
 */
export async function processSystemJobs() {
  try {
    // Get pending jobs ordered by priority and runAt
    const jobs = await db.systemJob.findMany({
      where: {
        status: "pending",
        runAt: { lte: new Date() },
        attempts: { lt: 3 }, // Default max attempts
      },
      orderBy: [
        { priority: "asc" },
        { runAt: "asc" },
      ],
      take: 10, // Process up to 10 jobs at a time
    });

    for (const job of jobs) {
      await processJob(job);
    }

    return { processed: jobs.length };
  } catch (error) {
    log.error("Failed to process system jobs", error as Error);
    throw error;
  }
}

/**
 * Process a single job
 */
async function processJob(job: any) {
  try {
    // Mark job as running
    await db.systemJob.update({
      where: { id: job.id },
      data: {
        status: "running",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    const payload = JSON.parse(job.payload);
    let result: any;

    // Process based on job type
    switch (job.type) {
      case "customer_data_export":
        result = await handleCustomerDataRequest({
          customerId: payload.customerId,
          customerEmail: payload.customerEmail,
          shopId: job.shopId!,
          requestedAt: payload.requestedAt,
          webhookId: payload.webhookId,
        });
        break;

      case "customer_data_redact":
        result = await handleCustomerRedactRequest({
          customerId: payload.customerId,
          customerEmail: payload.customerEmail,
          shopId: job.shopId!,
          ordersToRedact: payload.ordersToRedact,
          webhookId: payload.webhookId,
        });
        break;

      case "shop_data_redact":
        result = await handleShopRedactRequest({
          shopId: job.shopId!,
          shopDomain: payload.shopDomain,
          webhookId: payload.webhookId,
        });
        break;

      case "app_uninstall_cleanup_retry":
        result = await retryAppUninstallCleanup(job.shopId!, payload);
        break;

      case "data_retention_cleanup":
        result = await runDataRetentionCleanup(job.shopId!);
        break;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // Mark job as completed
    await db.systemJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        result: JSON.stringify(result),
      },
    });

    log.info(`Job ${job.id} completed successfully`, {
      type: job.type,
      shopId: job.shopId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check if we should retry
    const shouldRetry = job.attempts < job.maxAttempts - 1;
    
    await db.systemJob.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "pending" : "failed",
        errorMessage,
        runAt: shouldRetry ? new Date(Date.now() + 60000 * job.attempts) : undefined,
        completedAt: shouldRetry ? undefined : new Date(),
      },
    });

    log.error(`Job ${job.id} failed`, error as Error, {
      type: job.type,
      shopId: job.shopId,
      attempts: job.attempts,
      willRetry: shouldRetry,
    });
  }
}

/**
 * Retry app uninstall cleanup
 */
async function retryAppUninstallCleanup(shopId: string, payload: any) {
  try {
    // Archive all active registries for the shop
    const registries = await db.registry.updateMany({
      where: { 
        shopId,
        status: { in: ['active', 'paused'] }
      },
      data: { 
        status: 'archived',
        updatedAt: new Date()
      }
    });

    // Cancel any pending system jobs
    await db.systemJob.updateMany({
      where: {
        shopId,
        status: { in: ['pending', 'running'] },
        type: { not: 'app_uninstall_cleanup_retry' }
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        result: JSON.stringify({ 
          reason: 'App uninstalled - retry cleanup',
          cancelledAt: new Date().toISOString()
        })
      }
    });

    return {
      success: true,
      registriesArchived: registries.count,
      cleanupCompletedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Clean up old completed jobs
 */
export async function cleanupOldJobs(daysToKeep: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.systemJob.deleteMany({
      where: {
        status: { in: ["completed", "failed", "cancelled"] },
        completedAt: { lt: cutoffDate },
      },
    });

    log.info(`Cleaned up ${result.count} old jobs`);
    return { deletedCount: result.count };
  } catch (error) {
    log.error("Failed to cleanup old jobs", error as Error);
    throw error;
  }
}

/**
 * Get job statistics
 */
export async function getJobStatistics(shopId?: string) {
  const where = shopId ? { shopId } : {};
  
  const [total, pending, running, completed, failed] = await Promise.all([
    db.systemJob.count({ where }),
    db.systemJob.count({ where: { ...where, status: "pending" } }),
    db.systemJob.count({ where: { ...where, status: "running" } }),
    db.systemJob.count({ where: { ...where, status: "completed" } }),
    db.systemJob.count({ where: { ...where, status: "failed" } }),
  ]);

  return {
    total,
    pending,
    running,
    completed,
    failed,
    successRate: total > 0 ? (completed / total) * 100 : 0,
  };
}