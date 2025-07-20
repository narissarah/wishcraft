import crypto from "crypto";
import { log } from "~/lib/logger.server";

/**
 * Webhook Security Utilities
 * Implements HMAC verification for Shopify webhooks
 * Required for 2025 compliance
 */

/**
 * Verify Shopify webhook HMAC signature
 */
export function verifyWebhookHMAC(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    log.error("Missing HMAC signature in webhook request");
    return false;
  }

  try {
    const computedHmac = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("base64");

    // Use timingSafeEqual to prevent timing attacks
    const providedHmac = Buffer.from(signature, "base64");
    const computedHmacBuffer = Buffer.from(computedHmac, "base64");

    if (providedHmac.length !== computedHmacBuffer.length) {
      log.error("HMAC signature length mismatch");
      return false;
    }

    const isValid = crypto.timingSafeEqual(providedHmac, computedHmacBuffer);
    
    if (!isValid) {
      log.error("Invalid HMAC signature for webhook");
    } else {
      log.debug("Webhook HMAC signature verified successfully");
    }

    return isValid;
  } catch (error) {
    log.error("Error verifying HMAC signature", error as Error);
    return false;
  }
}

/**
 * Extract and verify webhook request
 */
export async function verifyWebhookRequest(request: Request): Promise<{
  isValid: boolean;
  payload: string;
  topic?: string;
  shop?: string;
}> {
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
  const topicHeader = request.headers.get("X-Shopify-Topic");
  const shopHeader = request.headers.get("X-Shopify-Shop-Domain");
  const timestampHeader = request.headers.get("X-Shopify-Webhook-Timestamp");
  const apiVersionHeader = request.headers.get("X-Shopify-API-Version");
  
  // Validate required headers
  const requiredHeaders = ["X-Shopify-Hmac-Sha256", "X-Shopify-Topic", "X-Shopify-Shop-Domain"];
  for (const header of requiredHeaders) {
    if (!request.headers.get(header)) {
      log.error(`Missing required webhook header: ${header}`);
      return { isValid: false, payload: "" };
    }
  }
  
  // Validate API version - FIXED: Explicit 2024-10 for compliance
  const expectedApiVersion = '2024-10'; // MANDATORY 2025 API version
  if (apiVersionHeader && apiVersionHeader !== expectedApiVersion) {
    log.error(`Invalid API version: ${apiVersionHeader}, expected: ${expectedApiVersion}`);
    return { isValid: false, payload: "" };
  }
  
  // Validate timestamp to prevent replay attacks
  if (timestampHeader) {
    const timestamp = parseInt(timestampHeader, 10);
    const age = Date.now() - (timestamp * 1000);
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    if (age > maxAge) {
      log.error(`Webhook timestamp too old: ${age}ms (max: ${maxAge}ms)`);
      return { isValid: false, payload: "" };
    }
  }
  
  const payload = await request.text();
  
  if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
    log.error("SHOPIFY_WEBHOOK_SECRET environment variable not set");
    return { isValid: false, payload };
  }

  const isValid = verifyWebhookHMAC(
    payload,
    hmacHeader,
    process.env.SHOPIFY_WEBHOOK_SECRET
  );

  return {
    isValid,
    payload,
    topic: topicHeader || undefined,
    shop: shopHeader || undefined,
  };
}

/**
 * Middleware for webhook HMAC verification
 */
export function withWebhookHMACVerification<T extends (...args: any[]) => any>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0]?.request as Request;
    
    if (!request) {
      throw new Error("Request object not found in handler arguments");
    }

    // Clone request to read body twice
    const clonedRequest = request.clone();
    const verification = await verifyWebhookRequest(clonedRequest);

    if (!verification.isValid) {
      log.error(`Webhook HMAC verification failed for ${request.url}`);
      throw new Response("Unauthorized - Invalid HMAC signature", { 
        status: 401,
        headers: {
          "Content-Type": "text/plain",
          "X-Webhook-Error": "Invalid HMAC signature"
        }
      });
    }

    log.debug(`Webhook HMAC verified for topic: ${verification.topic}, shop: ${verification.shop}`);
    
    // Call original handler with verified request
    return handler(...args);
  }) as T;
}

// First logWebhookEvent function removed to avoid duplicate

/**
 * Validate webhook topic
 */
export function validateWebhookTopic(topic: string | null | undefined, expectedTopic: string): boolean {
  if (!topic) {
    log.error(`Missing webhook topic header, expected: ${expectedTopic}`);
    return false;
  }

  if (topic !== expectedTopic) {
    log.error(`Invalid webhook topic: ${topic}, expected: ${expectedTopic}`);
    return false;
  }

  return true;
}

/**
 * Rate limit webhook requests with automatic cleanup
 */
const webhookRateLimit = new Map<string, { count: number; resetAt: number }>();

// Cleanup expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let cleanupTimer: NodeJS.Timeout | null = null;

function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, limit] of webhookRateLimit.entries()) {
    if (now > limit.resetAt) {
      webhookRateLimit.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    log.debug(`Cleaned up ${cleaned} expired webhook rate limit entries`);
  }
}

// Start cleanup timer
if (!cleanupTimer && typeof setInterval !== 'undefined') {
  cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
  
  // Ensure cleanup on process exit
  if (typeof process !== 'undefined') {
    process.on('exit', () => {
      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }
    });
  }
}

export function checkWebhookRateLimit(shop: string | null | undefined, maxRequests = 10, windowMs = 60000): boolean {
  if (!shop) return true; // Allow if no shop is provided
  const now = Date.now();
  const key = `webhook:${shop}`;
  const limit = webhookRateLimit.get(key) || { count: 0, resetAt: now + windowMs };

  // Reset if window expired
  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + windowMs;
  }

  limit.count++;
  webhookRateLimit.set(key, limit);

  // Opportunistic cleanup - every 100 requests
  if (webhookRateLimit.size > 100 && Math.random() < 0.1) {
    cleanupExpiredEntries();
  }

  if (limit.count > maxRequests) {
    log.warn(`Webhook rate limit exceeded for shop: ${shop}`);
    return false;
  }

  return true;
}

/**
 * Log webhook events for debugging and monitoring
 */
export async function logWebhookEvent(
  topic: string, 
  shop: string | null | undefined, 
  payload: any, 
  success: boolean, 
  error?: string | null
): Promise<void> {
  try {
    const logData = {
      topic,
      shop,
      success,
      error,
      timestamp: new Date().toISOString(),
      payloadSize: typeof payload === 'string' ? payload.length : JSON.stringify(payload).length
    };
    
    log.info(`Webhook Event: ${topic} for ${shop}`, logData);
    
    // In production, you might want to store this in a database
    // await db.webhookLog.create({ data: logData });
  } catch (logError) {
    log.error('Failed to log webhook event', logError as Error);
  }
}