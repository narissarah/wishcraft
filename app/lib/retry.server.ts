/**
 * Centralized Retry Logic for WishCraft
 * Eliminates duplicate retry patterns across the codebase
 */

import { log } from './logger.server';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponential?: boolean;
  jitter?: boolean;
  retryIf?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Exponential backoff with jitter
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  exponential: boolean = true,
  jitter: boolean = true
): number {
  let delay = exponential 
    ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    : baseDelay;
    
  if (jitter) {
    // Add random jitter up to 20% of delay
    delay += Math.random() * delay * 0.2;
  }
  
  return Math.floor(delay);
}

/**
 * Generic retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponential = true,
    jitter = true,
    retryIf
  } = options;

  const startTime = Date.now();
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime
      };
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry this error
      if (retryIf && !retryIf(lastError)) {
        break;
      }
      
      // Don't delay after the last attempt
      if (attempt < maxAttempts - 1) {
        const delay = calculateDelay(attempt, baseDelay, maxDelay, exponential, jitter);
        log.warn(`Operation failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms`, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return {
    success: false,
    error: lastError!,
    attempts: maxAttempts,
    totalTime: Date.now() - startTime
  };
}

/**
 * Retry function specifically for database operations
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'database operation'
): Promise<T> {
  const result = await retryWithBackoff(operation, {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    retryIf: (error) => {
      // Retry on connection errors, timeouts, but not on constraint violations
      const message = error.message.toLowerCase();
      return (
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('enotfound')
      ) && !message.includes('unique constraint');
    }
  });

  if (!result.success) {
    log.error(`${operationName} failed after ${result.attempts} attempts`, result.error!);
    throw result.error;
  }

  if (result.attempts > 1) {
    log.info(`${operationName} succeeded after ${result.attempts} attempts (${result.totalTime}ms)`);
  }

  return result.result!;
}

/**
 * Retry function specifically for HTTP requests
 */
export async function retryHttpRequest<T>(
  operation: () => Promise<T>,
  operationName: string = 'HTTP request'
): Promise<T> {
  const result = await retryWithBackoff(operation, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryIf: (error) => {
      // Retry on network errors and 5xx status codes
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('50') // 5xx status codes
      ) && !message.includes('401') && !message.includes('403'); // Don't retry auth errors
    }
  });

  if (!result.success) {
    log.error(`${operationName} failed after ${result.attempts} attempts`, result.error!);
    throw result.error;
  }

  if (result.attempts > 1) {
    log.info(`${operationName} succeeded after ${result.attempts} attempts (${result.totalTime}ms)`);
  }

  return result.result!;
}

/**
 * Retry function for Shopify GraphQL operations
 */
export async function retryShopifyOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Shopify operation'
): Promise<T> {
  const result = await retryWithBackoff(operation, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    retryIf: (error) => {
      const message = error.message.toLowerCase();
      // Retry on rate limits, throttling, and network issues
      return (
        message.includes('throttled') ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('504')
      );
    }
  });

  if (!result.success) {
    log.error(`${operationName} failed after ${result.attempts} attempts`, result.error!);
    throw result.error;
  }

  if (result.attempts > 1) {
    log.info(`${operationName} succeeded after ${result.attempts} attempts (${result.totalTime}ms)`);
  }

  return result.result!;
}

/**
 * Circuit breaker pattern for preventing cascade failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures: number = 5,
    private timeoutMs: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}