// ARCHITECTURE FIX: Shopify API wrapper with circuit breaker protection
import { authenticate } from "~/shopify.server";
import { safeGraphQLQuery, safeRESTCall } from "~/lib/shopify-circuit-breakers.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { log } from "~/lib/logger.server";

// Enhanced authenticate function with circuit breaker protection
export async function authenticateWithCircuitBreaker(request: Request) {
  const auth = await authenticate.admin(request);
  
  // Wrap the admin API with circuit breaker protection
  const protectedAdmin = {
    ...auth.admin,
    graphql: async (query: string, options?: any) => {
      return safeGraphQLQuery(auth.admin, query, options?.variables);
    },
    rest: {
      ...auth.admin.rest,
      get: async (options: any) => {
        return safeRESTCall(auth.admin, options.path, { method: 'GET' });
      },
      post: async (options: any) => {
        return safeRESTCall(auth.admin, options.path, { 
          method: 'POST',
          body: JSON.stringify(options.data),
          headers: { 'Content-Type': 'application/json' }
        });
      },
      put: async (options: any) => {
        return safeRESTCall(auth.admin, options.path, { 
          method: 'PUT',
          body: JSON.stringify(options.data),
          headers: { 'Content-Type': 'application/json' }
        });
      },
      delete: async (options: any) => {
        return safeRESTCall(auth.admin, options.path, { method: 'DELETE' });
      }
    }
  };
  
  return {
    ...auth,
    admin: protectedAdmin
  };
}

// Helper function to create protected loader
export function createProtectedLoader<T extends LoaderFunctionArgs>(
  loader: (args: T & { admin: any; session: any }) => Promise<any>
) {
  return async (args: T) => {
    try {
      const { admin, session } = await authenticateWithCircuitBreaker(args.request);
      return loader({ ...args, admin, session });
    } catch (error) {
      log.error('Protected loader error', error);
      
      // Check if it's a circuit breaker error
      if (error instanceof Error && error.message.includes('Circuit breaker')) {
        throw new Response('Service temporarily unavailable', { status: 503 });
      }
      
      throw error;
    }
  };
}

// Helper function to create protected action
export function createProtectedAction<T extends ActionFunctionArgs>(
  action: (args: T & { admin: any; session: any }) => Promise<any>
) {
  return async (args: T) => {
    try {
      const { admin, session } = await authenticateWithCircuitBreaker(args.request);
      return action({ ...args, admin, session });
    } catch (error) {
      log.error('Protected action error', error);
      
      // Check if it's a circuit breaker error
      if (error instanceof Error && error.message.includes('Circuit breaker')) {
        throw new Response('Service temporarily unavailable', { status: 503 });
      }
      
      throw error;
    }
  };
}

// Retry logic with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry circuit breaker open errors
      if (lastError.message.includes('Circuit breaker') && lastError.message.includes('OPEN')) {
        throw lastError;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        log.warn(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Bulk operation wrapper with circuit breaker
export async function bulkOperationWithCircuitBreaker<T>(
  items: T[],
  operation: (item: T) => Promise<any>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    continueOnError?: boolean;
  } = {}
) {
  const {
    batchSize = 10,
    delayBetweenBatches = 100,
    continueOnError = false
  } = options;
  
  const results: Array<{ success: boolean; data?: any; error?: Error }> = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (item, index) => {
      try {
        const data = await operation(item);
        return { success: true, data, index: i + index };
      } catch (error) {
        const err = error as Error;
        log.error(`Bulk operation failed for item ${i + index}`, err);
        
        if (!continueOnError && err.message.includes('Circuit breaker')) {
          throw err;
        }
        
        return { success: false, error: err, index: i + index };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Check if circuit breaker is open
    const circuitBreakerError = batchResults.find(r => 
      !r.success && r.error?.message.includes('Circuit breaker') && r.error.message.includes('OPEN')
    );
    
    if (circuitBreakerError && !continueOnError) {
      throw circuitBreakerError.error;
    }
    
    // Delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}