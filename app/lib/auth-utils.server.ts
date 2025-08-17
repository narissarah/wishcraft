import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Authentication utilities with retry logic for intermittent errors
 */

/**
 * Authenticate with retry logic for intermittent failures
 * This helps handle the ~5% of requests that fail with token expiration
 */
export async function authenticateWithRetry(
  request: Request,
  maxRetries = 2
) {
  const { authenticate } = await import("~/shopify.server");
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await authenticate.admin(request);
      
      // Validate the result
      if (!result.session || !result.admin) {
        throw new Error("Invalid authentication result");
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Log the attempt
      console.log(`[AUTH] Attempt ${attempt + 1} failed:`, error.message);
      
      // Don't retry if it's a definitive auth failure
      if (error.message?.includes("Missing shop") ||
          error.message?.includes("Invalid shop") ||
          error.message?.includes("App not installed")) {
        throw error;
      }
      
      // If we have retries left, wait before trying again
      if (attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms...
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
  }
  
  // All retries failed, throw the last error
  throw lastError;
}

/**
 * Ensure all required Shopify parameters are present in the URL
 */
export function ensureShopifyParams(request: Request): URL {
  const url = new URL(request.url);
  
  // List of parameters that should be preserved
  const paramsToCheck = ['shop', 'host', 'embedded', 'session', 'timestamp', 'locale'];
  
  // Check if we're missing any critical params
  const missingParams = paramsToCheck.filter(param => !url.searchParams.get(param));
  
  if (missingParams.length > 0) {
    console.warn('[AUTH] Missing Shopify parameters:', missingParams);
    
    // Try to recover from headers
    const shopHeader = request.headers.get('X-Shopify-Shop-Domain');
    if (shopHeader && !url.searchParams.get('shop')) {
      url.searchParams.set('shop', shopHeader);
    }
  }
  
  return url;
}

/**
 * Create a redirect that preserves all Shopify parameters
 */
export function createAuthenticatedRedirect(
  request: Request,
  destination: string
): Response {
  const url = new URL(request.url);
  const destUrl = new URL(destination, url.origin);
  
  // Preserve all existing search params
  url.searchParams.forEach((value, key) => {
    if (!destUrl.searchParams.has(key)) {
      destUrl.searchParams.set(key, value);
    }
  });
  
  return new Response(null, {
    status: 302,
    headers: {
      Location: destUrl.toString(),
    },
  });
}

/**
 * Handle authentication errors with proper recovery
 */
export async function handleAuthError(
  request: Request,
  error: any
): Promise<Response> {
  console.error('[AUTH] Authentication error:', error);
  
  // If it's the specific error about calling authenticate.admin from login path
  if (error.message?.includes('authenticate.admin() from configured login path')) {
    // This is the intermittent error - try to recover
    const { login } = await import("~/shopify.server");
    return login(request);
  }
  
  // For other auth errors, check if we should retry
  if (error.status === 401 || error.message?.includes('session expired')) {
    const { login } = await import("~/shopify.server");
    return login(request);
  }
  
  // Re-throw if we can't handle it
  throw error;
}