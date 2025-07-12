import * as cron from 'node-cron';
import { log } from '~/lib/logger.server';

/**
 * Job Processor for WishCraft Background Tasks
 * Handles scheduled tasks and background processing
 */

interface Job {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

class JobProcessor {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  
  register(job: Job): void {
    if (!job.enabled) {
      log.info(`Job ${job.name} is disabled`);
      return;
    }
    
    const task = cron.schedule(job.schedule, async () => {
      try {
        log.info(`Starting job: ${job.name}`);
        await job.handler();
        log.info(`Completed job: ${job.name}`);
      } catch (error) {
        log.error(`Job ${job.name} failed:`, error);
      }
    });
    
    this.jobs.set(job.name, task);
  }
  
  start(): void {
    this.jobs.forEach((task, name) => {
      task.start();
      log.info(`Started job: ${name}`);
    });
  }
  
  stop(): void {
    this.jobs.forEach((task, name) => {
      task.stop();
      log.info(`Stopped job: ${name}`);
    });
  }
  
  destroy(): void {
    this.stop();
    this.jobs.clear();
  }
}

// Singleton instance
export const jobProcessor = new JobProcessor();

// Register jobs
jobProcessor.register({
  name: 'cleanup-expired-registries',
  schedule: '0 2 * * *', // Daily at 2 AM
  handler: async () => {
    // Cleanup logic here
  },
  enabled: process.env.NODE_ENV === 'production'
});

jobProcessor.register({
  name: 'sync-inventory',
  schedule: '*/15 * * * *', // Every 15 minutes
  handler: async () => {
    // Inventory sync logic here
  },
  enabled: process.env.NODE_ENV === 'production'
});