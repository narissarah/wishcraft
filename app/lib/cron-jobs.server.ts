// Cron Jobs for Background Processing
import cron from "node-cron";
import { processSystemJobs, cleanupOldJobs } from "~/lib/job-processor.server";
import { log } from "~/lib/logger.server";
import { scheduleDataRetentionCleanup } from "~/lib/audit-log-retention.server";

let jobsInitialized = false;

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  if (jobsInitialized) {
    log.warn("Cron jobs already initialized");
    return;
  }

  // Only run cron jobs in production or if explicitly enabled
  if (process.env.NODE_ENV !== "production" && !process.env.ENABLE_CRON_JOBS) {
    log.info("Cron jobs disabled in development");
    return;
  }

  jobsInitialized = true;

  // Process system jobs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const result = await processSystemJobs();
      if (result.processed > 0) {
        log.info(`Processed ${result.processed} system jobs`);
      }
    } catch (error) {
      log.error("Failed to process system jobs", error as Error);
    }
  });

  // Clean up old jobs daily at 2 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      const result = await cleanupOldJobs(30); // Keep jobs for 30 days
      log.info(`Cleaned up ${result.deletedCount} old jobs`);
    } catch (error) {
      log.error("Failed to cleanup old jobs", error as Error);
    }
  });

  // Schedule data retention cleanup daily at 3 AM
  cron.schedule("0 3 * * *", async () => {
    try {
      await scheduleDataRetentionCleanup();
      log.info("Data retention cleanup jobs scheduled");
    } catch (error) {
      log.error("Failed to schedule data retention cleanup", error as Error);
    }
  });

  // Health check every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      // Log system health metrics
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      log.info("System health check", {
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB",
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + "MB",
        },
        uptime: Math.round(uptime / 60) + " minutes",
        node: process.version,
        platform: process.platform,
      });
    } catch (error) {
      log.error("Health check failed", error as Error);
    }
  });

  log.info("Cron jobs initialized successfully");
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopCronJobs() {
  cron.getTasks().forEach(task => task.stop());
  jobsInitialized = false;
  log.info("All cron jobs stopped");
}