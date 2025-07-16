/**
 * Retry utility for API calls with exponential backoff
 * Implements best practices for Shopify API rate limiting
 */

import { sleep } from "./utils.server";
import { log } from '~/lib/logger.server';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  factor: 2,
  jitter: true,
  onRetry: () => {},
  shouldRetry: (error) => {
    // Retry on network errors or specific status codes
    if (error.message.includes('ECONNRESET') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true;
    }
    
    // Check for rate limiting errors
    if (error.message.includes('429') || 
        error.message.includes('Too Many Requests') ||
        error.message.includes('THROTTLED')) {
      return true;
    }
    
    // Check for temporary server errors
    if (error.message.includes('502') || 
        error.message.includes('503') || 
        error.message.includes('504')) {
      return true;
    }
    
    return false;
  },
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      if (!opts.shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Don't retry if this was the last attempt
      if (attempt === opts.maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      let delay = opts.initialDelay * Math.pow(opts.factor, attempt - 1);
      
      // Apply jitter to prevent thundering herd
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      // Cap the delay at maxDelay
      delay = Math.min(delay, opts.maxDelay);
      
      // Check for Retry-After header in Shopify responses
      const retryAfter = extractRetryAfter(lastError);
      if (retryAfter) {
        delay = retryAfter * 1000; // Convert to milliseconds
      }
      
      // Call the retry callback
      opts.onRetry(lastError, attempt);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Extract Retry-After header from error response
 */
function extractRetryAfter(error: Error): number | null {
  // Check if error has response with headers
  if ('response' in error && error.response && typeof error.response === 'object') {
    const response = error.response as any;
    if (response.headers) {
      const retryAfter = response.headers['retry-after'] || 
                        response.headers['Retry-After'] ||
                        response.headers['x-retry-after'];
      
      if (retryAfter) {
        // Parse as seconds
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          return seconds;
        }
      }
    }
  }
  
  return null;
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options
      );
    };
    
    return descriptor;
  };
}

/**
 * Create a retry wrapper with preset options
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...options });
  };
}

/**
 * Shopify-specific retry wrapper with optimized settings
 */
export const shopifyRetry = createRetryWrapper({
  maxAttempts: 5,
  initialDelay: 2000,
  maxDelay: 60000,
  factor: 2,
  jitter: true,
  onRetry: (error, attempt) => {
    log.warn(`Shopify API retry attempt ${attempt}: ${error.message}`);
  },
  shouldRetry: (error) => {
    // Always retry rate limit errors
    if (error.message.includes('429') || 
        error.message.includes('THROTTLED') ||
        error.message.includes('Rate limit')) {
      return true;
    }
    
    // Use default retry logic for other errors
    return DEFAULT_OPTIONS.shouldRetry(error);
  },
});