/**
 * Comprehensive Error Handling Utilities for WishCraft
 * Built for Shopify 2025 Compliance
 */

import { log } from "~/lib/logger.server";
import { cache } from "~/lib/cache-unified.server";
import { CircuitBreaker } from "~/lib/circuit-breaker.server";

// Error categories for better handling
export enum ErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  DATABASE = "database",
  EXTERNAL_API = "external_api",
  NETWORK = "network",
  BUSINESS_LOGIC = "business_logic",
  SYSTEM = "system",
  RATE_LIMIT = "rate_limit",
  TIMEOUT = "timeout"
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

// Enhanced error class with categorization
export class WishCraftError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code?: string;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  
  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: {
      code?: string;
      context?: Record<string, any>;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = "WishCraftError";
    this.category = category;
    this.severity = severity;
    this.code = options.code;
    this.context = options.context;
    this.timestamp = new Date();
    this.retryable = options.retryable ?? this.isRetryableByDefault();
    
    if (options.cause) {
      this.cause = options.cause;
    }
  }
  
  private isRetryableByDefault(): boolean {
    return [
      ErrorCategory.NETWORK,
      ErrorCategory.TIMEOUT,
      ErrorCategory.RATE_LIMIT,
      ErrorCategory.EXTERNAL_API
    ].includes(this.category);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

// Circuit breaker for error handling
const errorHandlerCircuitBreaker = new CircuitBreaker(
  "error-handler",
  { failureThreshold: 5, recoveryTime: 30000 }
);

// Error handling utilities
export class ErrorHandler {
  /**
   * Handle async operations with comprehensive error handling
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    options: {
      operationName: string;
      category: ErrorCategory;
      context?: Record<string, any>;
      retryOptions?: {
        maxRetries: number;
        backoffMs: number;
        retryCondition?: (error: Error) => boolean;
      };
      fallback?: () => Promise<T> | T;
    }
  ): Promise<T> {
    const { operationName, category, context, retryOptions, fallback } = options;
    
    let lastError: Error;
    let attempts = 0;
    const maxAttempts = retryOptions?.maxRetries ? retryOptions.maxRetries + 1 : 1;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // Use circuit breaker for external operations
        if (category === ErrorCategory.EXTERNAL_API) {
          return await errorHandlerCircuitBreaker.execute(operation, fallback);
        }
        
        return await operation();
        
      } catch (error) {
        lastError = error as Error;
        
        // Enhanced error logging
        log.error(`Operation failed: ${operationName} (attempt ${attempts}/${maxAttempts})`, {
          error: lastError.message,
          category,
          context,
          stack: lastError.stack,
          attempt: attempts,
          timestamp: new Date().toISOString()
        });
        
        // Check if retry is possible
        if (attempts < maxAttempts) {
          const shouldRetry = retryOptions?.retryCondition 
            ? retryOptions.retryCondition(lastError)
            : this.isRetryableError(lastError);
          
          if (shouldRetry) {
            // Exponential backoff
            const backoffMs = retryOptions?.backoffMs || 1000;
            const delay = backoffMs * Math.pow(2, attempts - 1);
            
            log.info(`Retrying operation: ${operationName} in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // No more retries or not retryable
        break;
      }
    }
    
    // All attempts failed
    const wishCraftError = this.createWishCraftError(lastError, category, context);
    
    // Try fallback if available
    if (fallback) {
      try {
        log.info(`Using fallback for failed operation: ${operationName}`);
        return await fallback();
      } catch (fallbackError) {
        log.error(`Fallback also failed for operation: ${operationName}`, fallbackError);
      }
    }
    
    throw wishCraftError;
  }
  
  /**
   * Create a WishCraftError from a generic error
   */
  static createWishCraftError(
    error: Error,
    category: ErrorCategory,
    context?: Record<string, any>
  ): WishCraftError {
    if (error instanceof WishCraftError) {
      return error;
    }
    
    const severity = this.determineSeverity(error, category);
    const code = this.extractErrorCode(error);
    
    return new WishCraftError(
      error.message,
      category,
      severity,
      {
        code,
        context,
        retryable: this.isRetryableError(error),
        cause: error
      }
    );
  }
  
  /**
   * Determine if an error is retryable
   */
  static isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'network',
      'timeout',
      'connection',
      'rate limit',
      'temporary',
      'unavailable',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT'
    ];
    
    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }
  
  /**
   * Determine error severity
   */
  static determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Critical errors that break core functionality
    if (category === ErrorCategory.DATABASE || 
        category === ErrorCategory.AUTHENTICATION ||
        error.message.includes('CRITICAL')) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High priority errors
    if (category === ErrorCategory.AUTHORIZATION ||
        category === ErrorCategory.BUSINESS_LOGIC ||
        error.message.includes('HIGH')) {
      return ErrorSeverity.HIGH;
    }
    
    // Low priority errors
    if (category === ErrorCategory.VALIDATION ||
        error.message.includes('LOW')) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }
  
  /**
   * Extract error code from error message or stack
   */
  static extractErrorCode(error: Error): string | undefined {
    // Check for HTTP status codes
    const httpCodeMatch = error.message.match(/(\d{3})/);
    if (httpCodeMatch) {
      return `HTTP_${httpCodeMatch[1]}`;
    }
    
    // Check for database error codes
    if (error.message.includes('P2002')) return 'DB_UNIQUE_CONSTRAINT';
    if (error.message.includes('P2025')) return 'DB_RECORD_NOT_FOUND';
    if (error.message.includes('ECONNREFUSED')) return 'CONNECTION_REFUSED';
    
    return undefined;
  }
  
  /**
   * Report error to monitoring services
   */
  static async reportError(error: WishCraftError, context?: Record<string, any>): Promise<void> {
    try {
      // Log the error
      log.error("WishCraft Error", {
        ...error.toJSON(),
        additionalContext: context
      });
      
      // Cache error for debugging (temporary storage)
      if (error.severity === ErrorSeverity.CRITICAL) {
        await cache.set(
          `error:${error.timestamp.getTime()}`,
          error.toJSON(),
          300 // 5 minutes
        );
      }
      
      // Report to external monitoring (in production)
      if (process.env.NODE_ENV === 'production') {
        // Report to Sentry, DataDog, etc.
        // Implementation depends on your monitoring setup
        
        // Example: Send to webhook endpoint
        if (process.env.ERROR_WEBHOOK_URL) {
          await fetch(process.env.ERROR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...error.toJSON(),
              additionalContext: context
            })
          }).catch(webhookError => {
            log.error("Failed to send error to webhook", webhookError);
          });
        }
      }
    } catch (reportError) {
      log.error("Failed to report error", reportError);
    }
  }
  
  /**
   * Create database error handler
   */
  static createDatabaseErrorHandler<T>(
    operationName: string,
    context?: Record<string, any>
  ) {
    return (operation: () => Promise<T>) => this.handleAsync(operation, {
      operationName,
      category: ErrorCategory.DATABASE,
      context,
      retryOptions: {
        maxRetries: 2,
        backoffMs: 1000
      }
    });
  }
  
  /**
   * Create API error handler
   */
  static createAPIErrorHandler<T>(
    operationName: string,
    context?: Record<string, any>
  ) {
    return (operation: () => Promise<T>) => this.handleAsync(operation, {
      operationName,
      category: ErrorCategory.EXTERNAL_API,
      context,
      retryOptions: {
        maxRetries: 3,
        backoffMs: 2000
      }
    });
  }
}

// Common error factories
export const errors = {
  validation: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.VALIDATION, ErrorSeverity.LOW, { context }),
  
  authentication: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.AUTHENTICATION, ErrorSeverity.CRITICAL, { context }),
  
  authorization: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.AUTHORIZATION, ErrorSeverity.HIGH, { context }),
  
  database: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.DATABASE, ErrorSeverity.CRITICAL, { context }),
  
  network: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, { context, retryable: true }),
  
  businessLogic: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.BUSINESS_LOGIC, ErrorSeverity.HIGH, { context }),
  
  system: (message: string, context?: Record<string, any>) => 
    new WishCraftError(message, ErrorCategory.SYSTEM, ErrorSeverity.CRITICAL, { context })
};

// Export utility functions
export { ErrorCategory, ErrorSeverity, WishCraftError, ErrorHandler };