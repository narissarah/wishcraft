// Advanced Error Handling and Recovery System for Built for Shopify Compliance
import { CircuitBreaker } from "~/lib/circuit-breaker.server";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

/**
 * Error Recovery Configuration
 */
export const ERROR_RECOVERY_CONFIG = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 5000], // Progressive delays in ms
  
  // Circuit breaker thresholds
  CIRCUIT_BREAKER_THRESHOLD: 5, // errors before opening
  CIRCUIT_BREAKER_TIMEOUT: 30000, // 30 seconds
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX: 100, // requests per window
  
  // Health check intervals
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  
  // Error tracking
  ERROR_TRACKING_RETENTION: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Error categories for recovery strategies
 */
export enum ErrorCategory {
  SHOPIFY_API = "shopify_api",
  DATABASE = "database",
  WEBHOOK = "webhook",
  RATE_LIMIT = "rate_limit",
  TIMEOUT = "timeout",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

/**
 * Recovery strategies for different error types
 */
export enum RecoveryStrategy {
  RETRY = "retry",
  CIRCUIT_BREAKER = "circuit_breaker",
  FALLBACK = "fallback",
  QUEUE = "queue",
  IGNORE = "ignore",
  ESCALATE = "escalate",
}

/**
 * Error context for recovery decisions
 */
export interface ErrorContext {
  error: Error;
  category: ErrorCategory;
  operation: string;
  attempt: number;
  shopId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  finalAttempt: number;
  totalDuration: number;
  fallbackUsed: boolean;
  queuedForRetry: boolean;
  error?: Error;
}

/**
 * Advanced Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private errorTracker: Map<string, ErrorContext[]> = new Map();
  
  constructor() {
    // Start periodic cleanup
    setInterval(() => this.cleanupErrorHistory(), ERROR_RECOVERY_CONFIG.HEALTH_CHECK_INTERVAL);
  }
  
  /**
   * Handle error with automatic recovery
   */
  async handleError(context: ErrorContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Log the error
      await this.logError(context);
      
      // Track error patterns
      this.trackError(context);
      
      // Determine recovery strategy
      const strategy = this.determineStrategy(context);
      
      // Execute recovery strategy
      const result = await this.executeStrategy(strategy, context);
      
      // Log recovery result
      await this.logRecoveryResult(context, result);
      
      return {
        ...result,
        totalDuration: Date.now() - startTime,
      };
    } catch (recoveryError) {
      log.error("Error recovery failed", recoveryError as Error, {
        originalError: context.error.message,
        operation: context.operation,
        shopId: context.shopId,
      });
      
      return {
        success: false,
        strategy: RecoveryStrategy.ESCALATE,
        finalAttempt: context.attempt,
        totalDuration: Date.now() - startTime,
        fallbackUsed: false,
        queuedForRetry: false,
        error: recoveryError as Error,
      };
    }
  }
  
  /**
   * Determine appropriate recovery strategy
   */
  private determineStrategy(context: ErrorContext): RecoveryStrategy {
    const { error, category, attempt } = context;
    
    // Check if circuit breaker should be used
    if (this.shouldUseCircuitBreaker(category, context.operation)) {
      return RecoveryStrategy.CIRCUIT_BREAKER;
    }
    
    // Check rate limiting
    if (this.isRateLimited(context.shopId || "global", context.operation)) {
      return RecoveryStrategy.QUEUE;
    }
    
    // Strategy by error category
    switch (category) {
      case ErrorCategory.SHOPIFY_API:
        return this.getShopifyApiStrategy(error, attempt);
      case ErrorCategory.DATABASE:
        return this.getDatabaseStrategy(error, attempt);
      case ErrorCategory.WEBHOOK:
        return this.getWebhookStrategy(error, attempt);
      case ErrorCategory.TIMEOUT:
        return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
          RecoveryStrategy.RETRY : RecoveryStrategy.FALLBACK;
      case ErrorCategory.NETWORK:
        return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
          RecoveryStrategy.RETRY : RecoveryStrategy.QUEUE;
      case ErrorCategory.VALIDATION:
        return RecoveryStrategy.IGNORE; // Don't retry validation errors
      case ErrorCategory.AUTHENTICATION:
        return RecoveryStrategy.ESCALATE; // Needs manual intervention
      default:
        return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
          RecoveryStrategy.RETRY : RecoveryStrategy.ESCALATE;
    }
  }
  
  /**
   * Execute recovery strategy
   */
  private async executeStrategy(
    strategy: RecoveryStrategy, 
    context: ErrorContext
  ): Promise<RecoveryResult> {
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        return this.executeRetry(context);
      case RecoveryStrategy.CIRCUIT_BREAKER:
        return this.executeCircuitBreaker(context);
      case RecoveryStrategy.FALLBACK:
        return this.executeFallback(context);
      case RecoveryStrategy.QUEUE:
        return this.executeQueue(context);
      case RecoveryStrategy.IGNORE:
        return this.executeIgnore(context);
      case RecoveryStrategy.ESCALATE:
        return this.executeEscalate(context);
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }
  
  /**
   * Execute retry strategy
   */
  private async executeRetry(context: ErrorContext): Promise<RecoveryResult> {
    const { attempt } = context;
    const delay = ERROR_RECOVERY_CONFIG.RETRY_DELAYS[attempt - 1] || 5000;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      success: false, // Caller needs to retry the operation
      strategy: RecoveryStrategy.RETRY,
      finalAttempt: attempt,
      totalDuration: delay,
      fallbackUsed: false,
      queuedForRetry: false,
    };
  }
  
  /**
   * Execute circuit breaker strategy
   */
  private async executeCircuitBreaker(context: ErrorContext): Promise<RecoveryResult> {
    const breakerKey = `${context.category}-${context.operation}`;
    let breaker = this.circuitBreakers.get(breakerKey);
    
    if (!breaker) {
      breaker = new CircuitBreaker(
        breakerKey,
        async () => { throw new Error("Circuit breaker activated"); },
        {
          failureThreshold: ERROR_RECOVERY_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
          resetTimeout: ERROR_RECOVERY_CONFIG.CIRCUIT_BREAKER_TIMEOUT,
        }
      );
      this.circuitBreakers.set(breakerKey, breaker);
    }
    
    // Record failure and check if circuit should open
    const isOpen = breaker.getState() === "OPEN";
    
    if (isOpen) {
      // Use fallback when circuit is open
      return this.executeFallback(context);
    }
    
    return {
      success: false,
      strategy: RecoveryStrategy.CIRCUIT_BREAKER,
      finalAttempt: context.attempt,
      totalDuration: 0,
      fallbackUsed: false,
      queuedForRetry: false,
    };
  }
  
  /**
   * Execute fallback strategy
   */
  private async executeFallback(context: ErrorContext): Promise<RecoveryResult> {
    // Implement fallback logic based on operation type
    const fallbackResult = await this.getFallbackResult(context);
    
    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      finalAttempt: context.attempt,
      totalDuration: 0,
      fallbackUsed: true,
      queuedForRetry: false,
    };
  }
  
  /**
   * Execute queue strategy
   */
  private async executeQueue(context: ErrorContext): Promise<RecoveryResult> {
    // Queue the operation for later retry
    await this.queueOperation(context);
    
    return {
      success: false,
      strategy: RecoveryStrategy.QUEUE,
      finalAttempt: context.attempt,
      totalDuration: 0,
      fallbackUsed: false,
      queuedForRetry: true,
    };
  }
  
  /**
   * Execute ignore strategy
   */
  private async executeIgnore(context: ErrorContext): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: RecoveryStrategy.IGNORE,
      finalAttempt: context.attempt,
      totalDuration: 0,
      fallbackUsed: false,
      queuedForRetry: false,
    };
  }
  
  /**
   * Execute escalate strategy
   */
  private async executeEscalate(context: ErrorContext): Promise<RecoveryResult> {
    // Send alert to monitoring system
    await this.sendAlert(context);
    
    return {
      success: false,
      strategy: RecoveryStrategy.ESCALATE,
      finalAttempt: context.attempt,
      totalDuration: 0,
      fallbackUsed: false,
      queuedForRetry: false,
    };
  }
  
  /**
   * Get Shopify API recovery strategy
   */
  private getShopifyApiStrategy(error: Error, attempt: number): RecoveryStrategy {
    const message = error.message.toLowerCase();
    
    if (message.includes("rate limit") || message.includes("throttle")) {
      return RecoveryStrategy.QUEUE;
    }
    
    if (message.includes("timeout") || message.includes("network")) {
      return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
        RecoveryStrategy.RETRY : RecoveryStrategy.CIRCUIT_BREAKER;
    }
    
    if (message.includes("unauthorized") || message.includes("forbidden")) {
      return RecoveryStrategy.ESCALATE;
    }
    
    return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
      RecoveryStrategy.RETRY : RecoveryStrategy.FALLBACK;
  }
  
  /**
   * Get database recovery strategy
   */
  private getDatabaseStrategy(error: Error, attempt: number): RecoveryStrategy {
    const message = error.message.toLowerCase();
    
    if (message.includes("connection") || message.includes("timeout")) {
      return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
        RecoveryStrategy.RETRY : RecoveryStrategy.CIRCUIT_BREAKER;
    }
    
    if (message.includes("constraint") || message.includes("duplicate")) {
      return RecoveryStrategy.IGNORE;
    }
    
    return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
      RecoveryStrategy.RETRY : RecoveryStrategy.ESCALATE;
  }
  
  /**
   * Get webhook recovery strategy
   */
  private getWebhookStrategy(error: Error, attempt: number): RecoveryStrategy {
    // Webhooks should be queued for retry to prevent data loss
    return attempt < ERROR_RECOVERY_CONFIG.MAX_RETRIES ? 
      RecoveryStrategy.QUEUE : RecoveryStrategy.FALLBACK;
  }
  
  /**
   * Check if circuit breaker should be used
   */
  private shouldUseCircuitBreaker(category: ErrorCategory, operation: string): boolean {
    const breakerKey = `${category}-${operation}`;
    const breaker = this.circuitBreakers.get(breakerKey);
    return breaker ? breaker.getState() === "OPEN" : false;
  }
  
  /**
   * Check if operation is rate limited
   */
  private isRateLimited(key: string, operation: string): boolean {
    const limiterKey = `${key}-${operation}`;
    const limiter = this.rateLimiters.get(limiterKey);
    
    if (!limiter) {
      this.rateLimiters.set(limiterKey, {
        count: 1,
        resetTime: Date.now() + ERROR_RECOVERY_CONFIG.RATE_LIMIT_WINDOW,
      });
      return false;
    }
    
    if (Date.now() > limiter.resetTime) {
      limiter.count = 1;
      limiter.resetTime = Date.now() + ERROR_RECOVERY_CONFIG.RATE_LIMIT_WINDOW;
      return false;
    }
    
    limiter.count++;
    return limiter.count > ERROR_RECOVERY_CONFIG.RATE_LIMIT_MAX;
  }
  
  /**
   * Track error for pattern analysis
   */
  private trackError(context: ErrorContext): void {
    const key = `${context.category}-${context.operation}`;
    const errors = this.errorTracker.get(key) || [];
    
    errors.push({
      ...context,
      metadata: {
        ...context.metadata,
        timestamp: Date.now(),
      },
    });
    
    // Keep only recent errors
    const cutoff = Date.now() - ERROR_RECOVERY_CONFIG.ERROR_TRACKING_RETENTION;
    const recentErrors = errors.filter(e => 
      (e.metadata?.timestamp || 0) > cutoff
    );
    
    this.errorTracker.set(key, recentErrors);
  }
  
  /**
   * Get fallback result based on operation
   */
  private async getFallbackResult(context: ErrorContext): Promise<any> {
    // Return safe defaults based on operation type
    switch (context.operation) {
      case "get_product":
        return { id: null, title: "Product unavailable", available: false };
      case "get_customer":
        return { id: null, email: "unknown@example.com", firstName: "Unknown" };
      case "create_registry":
        return { id: "fallback", status: "pending" };
      default:
        return { success: false, fallback: true };
    }
  }
  
  /**
   * Queue operation for later retry
   */
  private async queueOperation(context: ErrorContext): Promise<void> {
    const delay = ERROR_RECOVERY_CONFIG.RETRY_DELAYS[context.attempt - 1] || 60000;
    
    await db.systemJob.create({
      data: {
        type: "error_recovery_retry",
        shopId: context.shopId,
        payload: JSON.stringify({
          operation: context.operation,
          error: context.error.message,
          attempt: context.attempt,
          metadata: context.metadata,
        }),
        priority: 3,
        runAt: new Date(Date.now() + delay),
      },
    });
  }
  
  /**
   * Send alert for escalated errors
   */
  private async sendAlert(context: ErrorContext): Promise<void> {
    log.error("Error escalated - manual intervention required", context.error, {
      operation: context.operation,
      shopId: context.shopId,
      category: context.category,
      attempt: context.attempt,
    });
    
    // Could integrate with external alerting systems here
    // e.g., Slack, PagerDuty, etc.
  }
  
  /**
   * Log error for monitoring
   */
  private async logError(context: ErrorContext): Promise<void> {
    await db.auditLog.create({
      data: {
        action: "error_occurred",
        resource: "system",
        resourceId: context.operation,
        shopId: context.shopId,
        userEmail: context.userId,
        metadata: JSON.stringify({
          error: context.error.message,
          category: context.category,
          attempt: context.attempt,
          stack: context.error.stack,
          ...context.metadata,
        }),
      },
    });
  }
  
  /**
   * Log recovery result
   */
  private async logRecoveryResult(
    context: ErrorContext, 
    result: RecoveryResult
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        action: "error_recovery",
        resource: "system",
        resourceId: context.operation,
        shopId: context.shopId,
        userEmail: context.userId,
        metadata: JSON.stringify({
          originalError: context.error.message,
          strategy: result.strategy,
          success: result.success,
          fallbackUsed: result.fallbackUsed,
          queuedForRetry: result.queuedForRetry,
          duration: result.totalDuration,
        }),
      },
    });
  }
  
  /**
   * Clean up old error history
   */
  private cleanupErrorHistory(): void {
    const cutoff = Date.now() - ERROR_RECOVERY_CONFIG.ERROR_TRACKING_RETENTION;
    
    for (const [key, errors] of this.errorTracker.entries()) {
      const recentErrors = errors.filter(e => 
        (e.metadata?.timestamp || 0) > cutoff
      );
      
      if (recentErrors.length === 0) {
        this.errorTracker.delete(key);
      } else {
        this.errorTracker.set(key, recentErrors);
      }
    }
  }
  
  /**
   * Get error statistics
   */
  public getErrorStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, errors] of this.errorTracker.entries()) {
      stats[key] = {
        total: errors.length,
        recent: errors.filter(e => 
          (e.metadata?.timestamp || 0) > Date.now() - 3600000 // Last hour
        ).length,
        categories: errors.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    }
    
    return stats;
  }
}

// Export singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();

/**
 * Categorize error automatically
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes("shopify") || message.includes("graphql")) {
    return ErrorCategory.SHOPIFY_API;
  }
  
  if (message.includes("prisma") || message.includes("database") || 
      message.includes("connection") || message.includes("query")) {
    return ErrorCategory.DATABASE;
  }
  
  if (message.includes("webhook") || message.includes("hmac")) {
    return ErrorCategory.WEBHOOK;
  }
  
  if (message.includes("rate limit") || message.includes("throttle")) {
    return ErrorCategory.RATE_LIMIT;
  }
  
  if (message.includes("timeout") || message.includes("timed out")) {
    return ErrorCategory.TIMEOUT;
  }
  
  if (message.includes("validation") || message.includes("invalid")) {
    return ErrorCategory.VALIDATION;
  }
  
  if (message.includes("unauthorized") || message.includes("forbidden") || 
      message.includes("authentication")) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  if (message.includes("network") || message.includes("fetch") || 
      message.includes("connection refused")) {
    return ErrorCategory.NETWORK;
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Wrapper function for operations with automatic error recovery
 */
export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  context: {
    operationName: string;
    shopId?: string;
    userId?: string;
    metadata?: Record<string, any>;
  },
  maxAttempts: number = ERROR_RECOVERY_CONFIG.MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      const errorContext: ErrorContext = {
        error: lastError,
        category: categorizeError(lastError),
        operation: context.operationName,
        attempt,
        shopId: context.shopId,
        userId: context.userId,
        metadata: context.metadata,
      };
      
      const recoveryResult = await errorRecoveryManager.handleError(errorContext);
      
      if (recoveryResult.success) {
        // Recovery succeeded, return result or continue
        continue;
      }
      
      if (recoveryResult.strategy === RecoveryStrategy.IGNORE) {
        throw lastError;
      }
      
      if (recoveryResult.strategy === RecoveryStrategy.ESCALATE) {
        throw lastError;
      }
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Continue to next attempt
    }
  }
  
  throw lastError;
}