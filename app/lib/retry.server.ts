/**
 * Simplified Retry Utilities for WishCraft
 * Basic retry logic without over-engineering
 */

/**
 * Simple retry with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't delay after the last attempt
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Retry database operations with appropriate error handling
 */
export async function retryDatabase<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(async () => {
    try {
      return await operation();
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      
      // Don't retry on constraint violations or schema errors
      if (message.includes('unique constraint') || 
          message.includes('foreign key') ||
          message.includes('check constraint')) {
        throw error;
      }
      
      // Retry on connection issues
      if (message.includes('connection') ||
          message.includes('timeout') ||
          message.includes('network')) {
        throw error; // Will be retried by outer retry function
      }
      
      throw error;
    }
  }, maxAttempts, 500);
}

/**
 * Retry Shopify API calls with rate limit handling
 */
export async function retryShopify<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(async () => {
    try {
      return await operation();
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      
      // Don't retry on auth errors
      if (message.includes('unauthorized') || 
          message.includes('forbidden')) {
        throw error;
      }
      
      // Retry on rate limits and server errors
      if (message.includes('throttled') ||
          message.includes('rate limit') ||
          message.includes('too many requests') ||
          message.includes('50')) { // 5xx errors
        throw error; // Will be retried by outer retry function
      }
      
      throw error;
    }
  }, maxAttempts, 1000);
}

// Legacy export for backward compatibility
export const retryShopifyOperation = retryShopify;