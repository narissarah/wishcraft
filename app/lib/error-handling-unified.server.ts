/**
 * Unified Error Handling System
 * Consolidates all error handling patterns into a single, comprehensive utility
 * Eliminates duplicate error handling logic across the codebase
 */

import { json, type DataFunctionArgs } from "@remix-run/node";
import { log } from "./logger.server";
import { RETRY_CONFIGS, TIMEOUTS } from "./constants-unified.server";

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  shopId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: any;
}

export interface RetryConfig {
  maxAttempts: number;
  delays: number[];
  retryableConditions: (error: any) => boolean;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    severity: ErrorSeverity = 'medium',
    context: ErrorContext = { operation: 'unknown' }
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, AppError);
  }
}

export class ValidationError extends AppError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string }> = [],
    context: ErrorContext = { operation: 'validation' }
  ) {
    super(message, 400, true, 'low', context);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class DatabaseError extends AppError {
  public readonly queryInfo?: {
    query: string;
    parameters?: any[];
    duration?: number;
  };

  constructor(
    message: string,
    queryInfo?: { query: string; parameters?: any[]; duration?: number },
    context: ErrorContext = { operation: 'database' }
  ) {
    super(message, 500, true, 'high', context);
    this.name = 'DatabaseError';
    this.queryInfo = queryInfo;
  }
}

export class ShopifyAPIError extends AppError {
  public readonly shopifyError?: {
    code?: string;
    statusCode?: number;
    response?: any;
    retryAfter?: number;
  };

  constructor(
    message: string,
    shopifyError?: { code?: string; statusCode?: number; response?: any; retryAfter?: number },
    context: ErrorContext = { operation: 'shopify_api' }
  ) {
    const statusCode = shopifyError?.statusCode || 500;
    const severity = statusCode >= 500 ? 'high' : 'medium';
    
    super(message, statusCode, true, severity, context);
    this.name = 'ShopifyAPIError';
    this.shopifyError = shopifyError;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    message: string,
    retryAfter: number,
    context: ErrorContext = { operation: 'rate_limit' }
  ) {
    super(message, 429, true, 'low', context);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class CircuitBreakerError extends AppError {
  public readonly nextRetryTime: Date;

  constructor(
    message: string,
    nextRetryTime: Date,
    context: ErrorContext = { operation: 'circuit_breaker' }
  ) {
    super(message, 503, true, 'medium', context);
    this.name = 'CircuitBreakerError';
    this.nextRetryTime = nextRetryTime;
  }
}

/**
 * Unified Error Handler Service
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService;

  private constructor() {}

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Handle and format errors for API responses
   */
  public handleError(error: any, context: ErrorContext = { operation: 'unknown' }): ErrorResponse {
    const requestId = context.requestId || this.generateRequestId();
    
    // Log the error
    this.logError(error, { ...context, requestId });

    // Format error response
    if (error instanceof AppError) {
      return this.formatAppError(error, requestId);
    }

    if (error instanceof ValidationError) {
      return this.formatValidationError(error, requestId);
    }

    if (error.name === 'ZodError') {
      return this.formatZodError(error, requestId);
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return this.formatNetworkError(error, requestId);
    }

    // Handle Prisma errors
    if (error.code?.startsWith('P')) {
      return this.formatPrismaError(error, requestId);
    }

    // Default error formatting
    return this.formatGenericError(error, requestId);
  }

  /**
   * Create standardized error response
   */
  public createErrorResponse(error: any, context: ErrorContext = { operation: 'unknown' }): Response {
    const errorResponse = this.handleError(error, context);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': errorResponse.requestId || this.generateRequestId()
    };

    // Add retry-after header for rate limit errors
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = error.retryAfter.toString();
    }

    // Add cache control headers
    if (errorResponse.statusCode >= 500) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    return json(errorResponse, {
      status: errorResponse.statusCode,
      headers
    });
  }

  /**
   * Retry operation with exponential backoff
   */
  public async retryOperation<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: ErrorContext = { operation: 'retry' }
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Log successful retry
        if (attempt > 1) {
          log.info('Operation succeeded after retry', {
            ...context,
            attempt,
            totalAttempts: config.maxAttempts
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!config.retryableConditions(error)) {
          log.warn('Operation failed with non-retryable error', {
            ...context,
            attempt,
            error: error.message
          });
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === config.maxAttempts) {
          break;
        }
        
        // Calculate delay
        const delay = config.delays[attempt - 1] || config.delays[config.delays.length - 1];
        
        log.warn('Operation failed, retrying', {
          ...context,
          attempt,
          totalAttempts: config.maxAttempts,
          delay,
          error: error.message
        });
        
        // Wait before retry
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted
    log.error('Operation failed after all retries', {
      ...context,
      totalAttempts: config.maxAttempts,
      error: lastError?.message
    });
    
    throw lastError;
  }

  /**
   * Wrap async operations with timeout
   */
  public async withTimeout<T>(
    operation: () => Promise<T>,
    timeout: number,
    context: ErrorContext = { operation: 'timeout' }
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AppError(
          `Operation timed out after ${timeout}ms`,
          408,
          true,
          'medium',
          context
        ));
      }, timeout);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      this.logError(error, context);
      throw error;
    }
  }

  /**
   * Safe execution wrapper
   */
  public async safeExecute<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: ErrorContext = { operation: 'safe_execute' }
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      log.warn('Safe execution failed, using fallback', {
        ...context,
        error: error.message,
        fallback
      });
      return fallback;
    }
  }

  /**
   * Log errors with appropriate level and context
   */
  private logError(error: any, context: ErrorContext): void {
    const logData = {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
        severity: error.severity,
        timestamp: new Date().toISOString()
      }
    };

    if (error instanceof AppError) {
      switch (error.severity) {
        case 'critical':
          log.error('Critical application error', logData);
          break;
        case 'high':
          log.error('High severity error', logData);
          break;
        case 'medium':
          log.warn('Medium severity error', logData);
          break;
        case 'low':
          log.info('Low severity error', logData);
          break;
        default:
          log.error('Application error', logData);
      }
    } else {
      log.error('Unhandled error', logData);
    }
  }

  /**
   * Format AppError for response
   */
  private formatAppError(error: AppError, requestId: string): ErrorResponse {
    return {
      error: error.name,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: error.timestamp.toISOString(),
      requestId,
      details: process.env.NODE_ENV === 'development' ? {
        context: error.context,
        severity: error.severity,
        stack: error.stack
      } : undefined
    };
  }

  /**
   * Format ValidationError for response
   */
  private formatValidationError(error: ValidationError, requestId: string): ErrorResponse {
    return {
      error: 'ValidationError',
      message: error.message,
      statusCode: 400,
      timestamp: error.timestamp.toISOString(),
      requestId,
      details: {
        validationErrors: error.validationErrors
      }
    };
  }

  /**
   * Format Zod validation error
   */
  private formatZodError(error: any, requestId: string): ErrorResponse {
    const validationErrors = error.errors?.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message
    })) || [];

    return {
      error: 'ValidationError',
      message: 'Validation failed',
      statusCode: 400,
      timestamp: new Date().toISOString(),
      requestId,
      details: {
        validationErrors
      }
    };
  }

  /**
   * Format network errors
   */
  private formatNetworkError(error: any, requestId: string): ErrorResponse {
    return {
      error: 'NetworkError',
      message: 'Network connection failed',
      statusCode: 503,
      timestamp: new Date().toISOString(),
      requestId,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      } : undefined
    };
  }

  /**
   * Format Prisma database errors
   */
  private formatPrismaError(error: any, requestId: string): ErrorResponse {
    const statusCode = this.getPrismaErrorStatusCode(error.code);
    const message = this.getPrismaErrorMessage(error.code);

    return {
      error: 'DatabaseError',
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        meta: error.meta,
        clientVersion: error.clientVersion
      } : undefined
    };
  }

  /**
   * Format generic errors
   */
  private formatGenericError(error: any, requestId: string): ErrorResponse {
    return {
      error: 'InternalError',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      statusCode: 500,
      timestamp: new Date().toISOString(),
      requestId,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack
      } : undefined
    };
  }

  /**
   * Get appropriate status code for Prisma errors
   */
  private getPrismaErrorStatusCode(code: string): number {
    switch (code) {
      case 'P2002': return 409; // Unique constraint violation
      case 'P2025': return 404; // Record not found
      case 'P2024': return 408; // Timeout
      case 'P2034': return 503; // Transaction failed
      default: return 500;
    }
  }

  /**
   * Get user-friendly message for Prisma errors
   */
  private getPrismaErrorMessage(code: string): string {
    switch (code) {
      case 'P2002': return 'A record with this information already exists';
      case 'P2025': return 'The requested record was not found';
      case 'P2024': return 'Database operation timed out';
      case 'P2034': return 'Database transaction failed';
      default: return 'A database error occurred';
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
export const errorHandler = ErrorHandlingService.getInstance();

// Common retry configurations
export const COMMON_RETRY_CONFIGS = {
  DATABASE: {
    maxAttempts: RETRY_CONFIGS.DATABASE.MAX_ATTEMPTS,
    delays: RETRY_CONFIGS.DATABASE.DELAYS,
    retryableConditions: (error: any) => 
      RETRY_CONFIGS.DATABASE.RETRYABLE_ERRORS.includes(error.code) ||
      error.code?.startsWith('P2024') || // Prisma timeout
      error.code?.startsWith('P2034')    // Prisma connection error
  },
  
  API: {
    maxAttempts: RETRY_CONFIGS.API.MAX_ATTEMPTS,
    delays: RETRY_CONFIGS.API.DELAYS,
    retryableConditions: (error: any) => 
      RETRY_CONFIGS.API.RETRYABLE_STATUS_CODES.includes(error.statusCode) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
  },
  
  SHOPIFY: {
    maxAttempts: RETRY_CONFIGS.SHOPIFY.MAX_ATTEMPTS,
    delays: RETRY_CONFIGS.SHOPIFY.DELAYS,
    retryableConditions: (error: any) => 
      RETRY_CONFIGS.SHOPIFY.RETRYABLE_STATUS_CODES.includes(error.statusCode) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
  }
};

// Convenience functions for common operations
export const retryDatabaseOperation = <T>(operation: () => Promise<T>, context?: ErrorContext) =>
  errorHandler.retryOperation(operation, COMMON_RETRY_CONFIGS.DATABASE, context);

export const retryAPIOperation = <T>(operation: () => Promise<T>, context?: ErrorContext) =>
  errorHandler.retryOperation(operation, COMMON_RETRY_CONFIGS.API, context);

export const retryShopifyOperation = <T>(operation: () => Promise<T>, context?: ErrorContext) =>
  errorHandler.retryOperation(operation, COMMON_RETRY_CONFIGS.SHOPIFY, context);

export const withDatabaseTimeout = <T>(operation: () => Promise<T>, context?: ErrorContext) =>
  errorHandler.withTimeout(operation, TIMEOUTS.DATABASE_QUERY, context);

export const withAPITimeout = <T>(operation: () => Promise<T>, context?: ErrorContext) =>
  errorHandler.withTimeout(operation, TIMEOUTS.HTTP_REQUEST, context);

export const safeExecute = <T>(operation: () => Promise<T>, fallback: T, context?: ErrorContext) =>
  errorHandler.safeExecute(operation, fallback, context);

// Express/Remix error handler wrapper
export const withErrorHandler = (
  handler: (args: DataFunctionArgs) => Promise<Response>
) => {
  return async (args: DataFunctionArgs): Promise<Response> => {
    try {
      return await handler(args);
    } catch (error) {
      const context: ErrorContext = {
        operation: 'http_handler',
        requestId: args.request.headers.get('x-request-id') || undefined,
        metadata: {
          url: args.request.url,
          method: args.request.method,
          userAgent: args.request.headers.get('user-agent')
        }
      };
      
      return errorHandler.createErrorResponse(error, context);
    }
  };
};

// Export error classes for use throughout the application
export {
  AppError,
  ValidationError,
  DatabaseError,
  ShopifyAPIError,
  RateLimitError,
  CircuitBreakerError
};