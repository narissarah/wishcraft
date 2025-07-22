/**
 * Unified Server-side Utilities for WishCraft
 * Consolidates utils, constants, error handling, circuit breaker, job processing, and response utilities
 */

import bcrypt from 'bcrypt';
import { json } from "@remix-run/node";
import { log } from '~/lib/logger.server';
import { db } from "~/lib/db.server";
import crypto from "crypto";

// ============================================
// Constants
// ============================================

// API Configuration
export const API_TIMEOUT = 30000;
export const API_RETRIES = 3;
export const SHOPIFY_API_VERSION = '2025-07';

// Rate Limits (per Shopify guidelines)
export const RATE_LIMITS = {
  API_CALLS: 40,        // per 2 seconds (Shopify limit)
  WEBHOOKS: 100,        // per minute
  UPLOADS: 5            // per minute
} as const;

// Cache TTL
export const CACHE_TTL = {
  SHORT: 60,            // 1 minute
  DEFAULT: 300,         // 5 minutes  
  LONG: 3600            // 1 hour
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 250;

// Security
export const MIN_SECRET_LENGTH = 32;
export const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const SALT_ROUNDS = 10;

// Registry Limits
export const REGISTRY_LIMITS = {
  MAX_ITEMS: 250,
  MAX_TITLE_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_COLLABORATORS: 50
} as const;

// ============================================
// Error Classes
// ============================================

// Standard error types
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'APP_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class ShopifyError extends AppError {
  constructor(message: string, statusCode: number = 422) {
    super(message, 'SHOPIFY_ERROR', statusCode);
    this.name = 'ShopifyError';
  }
}

// ============================================
// Utility Functions
// ============================================

// ============================================
// Error Handling Utilities
// ============================================

// Simple retry function
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Retry failed');
}

// Error response helper
export function errorResponse(error: unknown, defaultMessage: string = 'An error occurred') {
  const message = error instanceof Error ? error.message : defaultMessage;
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  
  log.error(message, { error });
  
  return json({ error: message }, { status: statusCode });
}

// ============================================
// Circuit Breaker Implementation
// ============================================

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  requestTimeout?: number;
}

export interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class CircuitBreaker {
  private failureThreshold: number;
  private resetTimeout: number;
  private requestTimeout: number;
  private state: CircuitBreakerState;
  private name: string;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.requestTimeout = options.requestTimeout || 30000; // 30 seconds
    this.state = {
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED'
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      const now = Date.now();
      if (this.state.lastFailureTime && 
          now - this.state.lastFailureTime > this.resetTimeout) {
        this.state.state = 'HALF_OPEN';
        log.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.requestTimeout)
        )
      ]);

      if (this.state.state === 'HALF_OPEN') {
        this.state.state = 'CLOSED';
        this.state.failureCount = 0;
        log.info(`Circuit breaker ${this.name} recovered to CLOSED state`);
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.failureThreshold) {
      this.state.state = 'OPEN';
      log.error(`Circuit breaker ${this.name} opened after ${this.state.failureCount} failures`);
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

// Circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  return circuitBreakers.get(name)!;
}

// Cleanup old circuit breakers periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const MAX_BREAKERS = 100;
    if (circuitBreakers.size > MAX_BREAKERS) {
      const entries = Array.from(circuitBreakers.entries());
      const toRemove = entries.slice(0, Math.floor(MAX_BREAKERS / 2));
      toRemove.forEach(([key]) => circuitBreakers.delete(key));
      log.warn(`Removed ${toRemove.length} old circuit breakers to prevent memory leak`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

// ============================================
// Job Processing System
// ============================================

export interface JobStatistics {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
}

export async function getJobStatistics(shopId: string): Promise<JobStatistics> {
  try {
    const [pending, running, completed, failed] = await Promise.all([
      db.system_jobs.count({
        where: { shopId, status: 'pending' }
      }),
      db.system_jobs.count({
        where: { shopId, status: 'running' }
      }),
      db.system_jobs.count({
        where: { shopId, status: 'completed' }
      }),
      db.system_jobs.count({
        where: { shopId, status: 'failed' }
      })
    ]);
    
    // Calculate average processing time for completed jobs
    const completedJobs = await db.system_jobs.findMany({
      where: { 
        shopId, 
        status: 'completed',
        completedAt: { not: null }
      },
      select: {
        createdAt: true,
        completedAt: true
      },
      take: 100 // Last 100 jobs
    });
    
    let averageProcessingTime = 0;
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, job) => {
        if (job.completedAt) {
          return sum + (job.completedAt.getTime() - job.createdAt.getTime());
        }
        return sum;
      }, 0);
      averageProcessingTime = totalTime / completedJobs.length;
    }
    
    return {
      pending,
      running,
      completed,
      failed,
      averageProcessingTime
    };
  } catch (error) {
    log.error('Failed to get job statistics', error as Error);
    return {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      averageProcessingTime: 0
    };
  }
}

export async function createJob(params: {
  shopId: string;
  type: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}) {
  try {
    const job = await db.system_jobs.create({
      data: {
        id: crypto.randomUUID(),
        shopId: params.shopId,
        type: params.type,
        payload: JSON.stringify(params.data),
        status: 'pending',
        priority: params.priority === 'high' ? 1 : params.priority === 'low' ? 9 : 5,
        attempts: 0,
        maxAttempts: 3,
        updatedAt: new Date()
      }
    });
    
    log.info('Job created', {
      jobId: job.id,
      type: job.type,
      shopId: job.shopId
    });
    
    return job;
  } catch (error) {
    log.error('Failed to create job', error as Error);
    throw error;
  }
}

export async function processJob(jobId: string) {
  try {
    // Mark job as running
    const job = await db.system_jobs.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    });
    
    // Process based on job type
    const payload = JSON.parse(job.payload || '{}');
    
    switch (job.type) {
      case 'customer_data_export':
        await handleCustomerDataExport(payload.customerId, payload.shopId);
        break;
      case 'customer_data_redact':
        await handleCustomerDataRedaction(payload.customerId, payload.shopId);
        break;
      case 'shop_data_redact':
        await handleShopDataRedaction(payload.shopId);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
    
    // Mark job as completed
    await db.system_jobs.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });
    
    log.info('Job completed', { jobId });
  } catch (error) {
    log.error('Job processing failed', error as Error);
    
    // Mark job as failed
    await db.system_jobs.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      }
    });
    
    throw error;
  }
}

// ============================================
// Response Utilities
// ============================================

export const responses = {
  // Success responses
  ok: (data?: any, message?: string) => 
    json({ success: true, message: message || "OK", data }, { status: 200 }),

  success: (data?: any, message?: string) => 
    json({ success: true, message: message || "Success", data }, { status: 200 }),
  
  created: (data?: any, message?: string) => 
    json({ success: true, message: message || "Created", data }, { status: 201 }),
  
  accepted: (data?: any, message?: string) =>
    json({ success: true, message: message || "Accepted", data }, { status: 202 }),
  
  noContent: () => new Response(null, { status: 204 }),
  
  // Client error responses
  badRequest: (message = "Bad Request", details?: any) =>
    json({ error: message, details }, { status: 400 }),
  
  unauthorized: (message = "Unauthorized") =>
    json({ error: message }, { status: 401 }),
  
  forbidden: (message = "Forbidden") =>
    json({ error: message }, { status: 403 }),
  
  notFound: (message = "Not Found") =>
    json({ error: message }, { status: 404 }),

  methodNotAllowed: (message = "Method Not Allowed") =>
    json({ error: message }, { status: 405 }),
  
  conflict: (message = "Conflict", details?: any) =>
    json({ error: message, details }, { status: 409 }),
  
  unprocessableEntity: (message = "Unprocessable Entity", details?: any) =>
    json({ error: message, details }, { status: 422 }),
  
  tooManyRequests: (message = "Too Many Requests", retryAfter?: number) => {
    const headers: HeadersInit = {};
    if (retryAfter) {
      headers["Retry-After"] = retryAfter.toString();
    }
    return json({ error: message }, { status: 429, headers });
  },
  
  // Server error responses
  serverError: (message = "Internal Server Error") =>
    json({ error: message }, { status: 500 }),

  internalServerError: (message = "Internal Server Error") =>
    json({ error: message }, { status: 500 }),
  
  notImplemented: (message = "Not Implemented") =>
    json({ error: message }, { status: 501 }),
  
  serviceUnavailable: (message = "Service Unavailable") =>
    json({ error: message }, { status: 503 }),
};

// Helper for handling webhook responses
export function handleWebhookResponse(success: boolean, message?: string): Response {
  if (success) {
    return responses.success(null, message);
  }
  return responses.internalServerError(message);
}

// Helper for parsing webhook payloads
export async function parseWebhookPayload<T = any>(request: Request): Promise<T> {
  const text = await request.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
}

// ============================================
// GDPR COMPLIANCE HANDLERS - Moved to gdpr-simple.server.ts
// ============================================

import { 
  handleCustomerDataExport, 
  handleCustomerDataRedaction, 
  handleShopDataRedaction 
} from './gdpr-simple.server';

// GDPR functions are now imported from gdpr-simple.server.ts
export { handleCustomerDataExport, handleCustomerDataRedaction, handleShopDataRedaction };

/**
 * Create GDPR compliance job
 * Helper function to queue GDPR-related data processing jobs
 */
export async function createGDPRJob(params: {
  type: 'customer_data_export' | 'customer_data_redact' | 'shop_data_redact';
  shopId: string;
  customerId?: string;
  metadata?: Record<string, any>;
}) {
  return createJob({
    shopId: params.shopId,
    type: params.type,
    priority: 'high', // GDPR requests are high priority
    data: {
      customerId: params.customerId,
      shopId: params.shopId,
      requestDate: new Date().toISOString(),
      ...params.metadata
    }
  });
}

