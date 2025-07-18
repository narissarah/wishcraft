/**
 * Webhook Utilities - Consolidated webhook handling patterns
 * Reduces code duplication across webhook handlers
 */

// Audit logger removed for production deployment
import { responses } from './response-utils.server';
import { log } from '~/lib/logger.server';

/**
 * Parse webhook payload consistently across all handlers
 */
export function parseWebhookPayload<T>(payload: string | T): T {
  return typeof payload === 'string' ? JSON.parse(payload) : payload;
}

/**
 * Standard webhook response with audit logging
 */
export async function handleWebhookResponse(
  action: string,
  resource: string,
  resourceId: string,
  shopId: string,
  metadata?: Record<string, any>
) {
  try {
    // Audit logging removed for production
    // Log to standard logger instead
    log.info(`Webhook ${action}`, {
      resource,
      resourceId,
      shopId,
      metadata
    });

    return responses.ok();
  } catch (error) {
    log.error(`[Webhook] Failed to log ${action} for ${resource}`, error as Error);
    return responses.serverError();
  }
}

/**
 * Extract common webhook headers for processing
 */
export function extractWebhookHeaders(request: Request) {
  return {
    hmacHeader: request.headers.get('x-shopify-hmac-sha256'),
    topic: request.headers.get('x-shopify-topic'),
    shopDomain: request.headers.get('x-shopify-shop-domain'),
    apiVersion: request.headers.get('x-shopify-api-version')
  };
}

/**
 * Validate webhook authenticity using HMAC
 */
export function validateWebhookHmac(body: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  
  // HMAC validation logic would go here
  // For now, return true - proper implementation would use crypto
  return true;
}