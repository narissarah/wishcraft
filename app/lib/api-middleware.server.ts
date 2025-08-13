import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { rateLimit, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from "~/lib/rate-limiter.server";
import { apiError } from "~/lib/api-response.server";
import { validateCSRFToken } from "~/lib/csrf.server";
import { log } from "~/lib/logger.server";

interface ApiMiddlewareOptions {
  rateLimit?: keyof typeof RATE_LIMIT_CONFIGS;
  requireCSRF?: boolean;
  requireAuth?: boolean;
}

/**
 * Middleware wrapper for API routes with rate limiting and security checks
 */
export function withApiMiddleware(
  handler: (args: LoaderFunctionArgs | ActionFunctionArgs) => Promise<Response>,
  options: ApiMiddlewareOptions = {}
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs) => {
    const { request } = args;
    const { 
      rateLimit: rateLimitConfig = 'api', 
      requireCSRF = false,
      requireAuth = false,
    } = options;
    
    try {
      // Apply rate limiting
      const rateLimitResult = await rateLimit(request, RATE_LIMIT_CONFIGS[rateLimitConfig]);
      
      if (!rateLimitResult.allowed) {
        return json(
          { 
            success: false, 
            error: RATE_LIMIT_CONFIGS[rateLimitConfig].message || 'Too many requests',
          },
          { 
            status: 429,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }
      
      // Validate CSRF token for mutations
      if (requireCSRF && request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          await validateCSRFToken(request);
        } catch (error) {
          log.warn('Invalid CSRF token', {
            endpoint: new URL(request.url).pathname,
            method: request.method,
            error: error instanceof Response ? error.statusText : 'Unknown error',
          });
          
          return apiError('Invalid CSRF token', 403);
        }
      }
      
      // Call the actual handler
      const response = await handler(args);
      
      // Add rate limit headers to response
      const responseHeaders = new Headers(response.headers);
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        if (value) responseHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
      
    } catch (error) {
      log.error('API middleware error', error as Error);
      
      // If error is already a Response, return it
      if (error instanceof Response) {
        return error;
      }
      
      return apiError('Internal server error', 500);
    }
  };
}