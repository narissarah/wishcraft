/**
 * Unified Webhook Module for WishCraft
 * Consolidates webhook security and handling for Shopify 2025 compliance
 */

import crypto from "crypto";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
// Removed CircuitBreaker - using direct error handling

// ============================================
// Webhook Security
// ============================================

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

// ============================================
// Centralized Webhook Handler Factory
// ============================================

export interface WebhookHandlerConfig {
  topic: string;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
  requireAuth?: boolean;
  skipHmacValidation?: boolean;
}

export interface WebhookContext {
  topic: string;
  shop: string;
  payload: any;
  session?: any;
  admin?: any;
  request: Request;
}

export type WebhookHandler = (context: WebhookContext) => Promise<Response>;

/**
 * Factory function that creates a standardized webhook handler
 * Eliminates boilerplate and ensures consistent security/logging
 */
export function createWebhookHandler(
  config: WebhookHandlerConfig,
  handler: WebhookHandler
) {
  return async (request: Request): Promise<Response> => {
    const startTime = Date.now();
    let verification: any = null;

    try {
      // Step 1: HMAC Verification (unless explicitly skipped)
      if (!config.skipHmacValidation) {
        verification = await verifyWebhookRequest(request.clone());
        
        if (!verification.isValid) {
          await logWebhookEvent(config.topic, verification?.shop || 'unknown', null, false, "Invalid HMAC signature");
          return new Response("Unauthorized - Invalid HMAC signature", { 
            status: 401,
            headers: { "Content-Type": "text/plain" }
          });
        }
      }

      // Step 2: Idempotency Check
      if (verification?.webhookId) {
        const isDuplicate = await checkWebhookProcessed(verification.webhookId);
        if (isDuplicate) {
          log.info(`Webhook ${verification.webhookId} already processed, skipping`);
          return json({ status: "already_processed" }, { status: 200 });
        }
      }

      // Step 3: Topic Validation
      const expectedTopic = config.topic.toUpperCase().replace(/\./g, '_');
      if (verification && !validateWebhookTopic(verification.topic, expectedTopic)) {
        await logWebhookEvent(config.topic, verification.shop, null, false, "Invalid topic");
        return new Response("Bad Request - Invalid topic", { 
          status: 400,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // Step 4: Rate Limiting
      const shop = verification?.shop || 'unknown';
      const rateLimit = config.rateLimit || { max: 20, windowMs: 60000 };
      
      if (!checkWebhookRateLimit(shop, rateLimit.max, rateLimit.windowMs)) {
        await logWebhookEvent(config.topic, shop, null, false, "Rate limit exceeded");
        return new Response("Too Many Requests", { 
          status: 429,
          headers: { 
            "Content-Type": "text/plain",
            "Retry-After": "60"
          }
        });
      }

      // Step 5: Parse payload
      const rawPayload = await request.text();
      let payload: any = {};
      
      try {
        payload = JSON.parse(rawPayload);
      } catch (error) {
        await logWebhookEvent(config.topic, shop, null, false, "Invalid JSON payload");
        return new Response("Bad Request - Invalid JSON", { 
          status: 400,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // Step 6: Authentication (if required)
      let session, admin;
      if (config.requireAuth) {
        try {
          const { authenticate } = await import("~/shopify.server");
          const authResult = await authenticate.webhook(request);
          session = authResult.session;
          admin = authResult.admin;
        } catch (error) {
          await logWebhookEvent(config.topic, shop, null, false, "Authentication failed");
          return new Response("Unauthorized - Authentication failed", { 
            status: 401,
            headers: { "Content-Type": "text/plain" }
          });
        }
      }

      // Step 7: Create context and execute handler
      const context: WebhookContext = {
        topic: config.topic,
        shop,
        payload,
        session,
        admin,
        request
      };

      const response = await handler(context);
      
      // Step 8: Mark webhook as processed (idempotency)
      if (verification?.webhookId) {
        await markWebhookProcessed(verification.webhookId);
      }
      
      // Step 9: Log successful execution
      const duration = Date.now() - startTime;
      await logWebhookEvent(config.topic, shop, payload, true, `Processed in ${duration}ms`);
      
      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      const shop = verification?.shop || 'unknown';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      log.error(`Webhook ${config.topic} failed:`, {
        shop,
        error: errorMessage,
        duration,
        stack: error instanceof Error ? error.stack : undefined
      });

      await logWebhookEvent(config.topic, shop, null, false, errorMessage);

      return new Response("Internal Server Error", { 
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  };
}

/**
 * Extract and verify webhook request
 */
export async function verifyWebhookRequest(request: Request): Promise<{
  isValid: boolean;
  payload: string;
  topic?: string;
  shop?: string;
  webhookId?: string;
}> {
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
  const topicHeader = request.headers.get("X-Shopify-Topic");
  const shopHeader = request.headers.get("X-Shopify-Shop-Domain");
  const timestampHeader = request.headers.get("X-Shopify-Webhook-Timestamp");
  const apiVersionHeader = request.headers.get("X-Shopify-API-Version");
  const webhookIdHeader = request.headers.get("X-Shopify-Webhook-Id");
  
  // Validate required headers
  const requiredHeaders = ["X-Shopify-Hmac-Sha256", "X-Shopify-Topic", "X-Shopify-Shop-Domain"];
  for (const header of requiredHeaders) {
    if (!request.headers.get(header)) {
      log.error(`Missing required webhook header: ${header}`);
      return { isValid: false, payload: "" };
    }
  }
  
  // Validate API version - Updated to 2025-07 for latest compliance
  const expectedApiVersion = '2025-07'; // Latest Shopify API version
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
    webhookId: webhookIdHeader || undefined,
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
 * Webhook idempotency tracking - stores processed webhook IDs
 * In production, this should be backed by a database
 */
const processedWebhooks = new Map<string, { processedAt: number }>();
const WEBHOOK_ID_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a webhook has already been processed
 */
export async function checkWebhookProcessed(webhookId: string): Promise<boolean> {
  // Check in-memory cache first
  const processed = processedWebhooks.get(webhookId);
  if (processed) {
    // Clean up old entries
    if (Date.now() - processed.processedAt > WEBHOOK_ID_TTL) {
      processedWebhooks.delete(webhookId);
      return false;
    }
    return true;
  }
  
  // In production, check database:
  // const webhook = await db.processedWebhook.findUnique({
  //   where: { webhookId }
  // });
  // return !!webhook;
  
  return false;
}

/**
 * Mark a webhook as processed
 */
export async function markWebhookProcessed(webhookId: string): Promise<void> {
  processedWebhooks.set(webhookId, { processedAt: Date.now() });
  
  // Clean up old entries periodically
  if (processedWebhooks.size > 10000) {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [id, data] of processedWebhooks.entries()) {
      if (now - data.processedAt > WEBHOOK_ID_TTL) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => processedWebhooks.delete(id));
  }
  
  // In production, store in database:
  // await db.processedWebhook.create({
  //   data: { webhookId, processedAt: new Date() }
  // });
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

  // MEMORY LEAK FIX: Deterministic cleanup when map grows too large
  // Run cleanup immediately if we exceed safe memory limit
  const MAX_SAFE_SIZE = 1000; // Prevent unbounded growth
  if (webhookRateLimit.size > MAX_SAFE_SIZE) {
    log.warn(`Webhook rate limit map size exceeded ${MAX_SAFE_SIZE}, running immediate cleanup`);
    cleanupExpiredEntries();
    
    // If still too large after cleanup, remove oldest entries
    if (webhookRateLimit.size > MAX_SAFE_SIZE) {
      const entries = Array.from(webhookRateLimit.entries())
        .sort((a, b) => a[1].resetAt - b[1].resetAt);
      
      const toRemove = entries.slice(0, Math.floor(MAX_SAFE_SIZE / 2));
      toRemove.forEach(([key]) => webhookRateLimit.delete(key));
      
      log.warn(`Removed ${toRemove.length} oldest webhook rate limit entries to prevent memory leak`);
    }
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

// ============================================
// Webhook Handler
// ============================================

export interface WebhookRegistration<T = any> {
  topic: string;
  handler: (data: T, shop: string) => Promise<void>;
  required?: boolean;
}

// Registry of webhook handlers
const webhookHandlers = new Map<string, WebhookRegistration>();

/**
 * Register a webhook handler
 */
export function registerWebhookHandler<T = any>(handler: WebhookRegistration<T>) {
  webhookHandlers.set(handler.topic, handler);
  log.info(`Webhook handler registered for topic: ${handler.topic}`);
}

/**
 * Process incoming webhook
 */
export async function processWebhook(request: Request) {
  const startTime = Date.now();
  const topic = request.headers.get("X-Shopify-Topic");
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  
  // Verify webhook signature
  const verification = await verifyWebhookRequest(request);
  
  if (!verification.isValid) {
    await logWebhookEvent(topic || "unknown", shop, null, false, "Invalid HMAC signature");
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Check rate limits
  if (!checkWebhookRateLimit(shop)) {
    await logWebhookEvent(topic || "unknown", shop, null, false, "Rate limit exceeded");
    return json({ error: "Too Many Requests" }, { status: 429 });
  }
  
  // Get handler
  const registration = webhookHandlers.get(topic || "");
  if (!registration) {
    log.warn(`No handler registered for webhook topic: ${topic}`);
    await logWebhookEvent(topic || "unknown", shop, null, false, "No handler found");
    return json({ error: "Handler not found" }, { status: 404 });
  }
  
  try {
    const data = JSON.parse(verification.payload);
    
    // Process webhook directly - removed CircuitBreaker
    await registration.handler(data, shop!);
    
    const duration = Date.now() - startTime;
    await logWebhookEvent(topic!, shop, data, true);
    
    log.info(`Webhook processed successfully`, {
      topic,
      shop,
      duration
    });
    
    return json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await logWebhookEvent(topic!, shop, null, false, errorMessage);
    
    log.error(`Webhook processing failed`, {
      topic,
      shop,
      duration,
      error: errorMessage
    });
    
    return json({ error: "Processing failed" }, { status: 500 });
  }
}

// WEBHOOK REGISTRATION SYSTEM REMOVED:
// - Prevents conflicts with route-based webhook handlers
// - Route-based approach in app/routes/webhooks.* is preferred
// - Cleaner separation of concerns
//
// All webhook handlers are now implemented as individual route files:
// - app/routes/webhooks.app.uninstalled.tsx
// - app/routes/webhooks.customers.redact.tsx  
// - app/routes/webhooks.shop.redact.tsx
// - app/routes/webhooks.products.update.tsx
// - app/routes/webhooks.orders.create.tsx

// All webhook handlers moved to individual route files for better organization
// No registration-based handlers to prevent conflicts

// Note: If you need to add webhook handlers through registration instead of routes,
// uncomment and modify the sample below:
//
// registerWebhookHandler({
//   topic: "example/webhook",
//   handler: async (data: any, shop: string) => {
//     // Handler implementation
//   }
// });

// Webhook registration helper
export async function registerRequiredWebhooks(admin: any, shop: string) {
  const requiredTopics = [
    "app/uninstalled",
    "customers/redact",
    "shop/redact",
    "products/update",
    "orders/paid"
  ];
  
  const appUrl = process.env.SHOPIFY_APP_URL;
  const results: { success: any[], failed: any[] } = { success: [], failed: [] };
  
  for (const topic of requiredTopics) {
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    
    while (attempts < maxAttempts && !success) {
      try {
        attempts++;
        
        const response = await admin.graphql(`
          mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription {
                id
                topic
                callbackUrl
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            topic: topic.toUpperCase().replace("/", "_"),
            webhookSubscription: {
              callbackUrl: `${appUrl}/webhooks`,
              format: "JSON"
            }
          }
        });
        
        const result = await response.json();
        
        if (result.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
          const errors = result.data.webhookSubscriptionCreate.userErrors;
          log.error(`Failed to register webhook ${topic} (attempt ${attempts}/${maxAttempts})`, {
            errors
          });
          
          // Check if error is retryable
          const isRetryable = errors.some((err: any) => 
            err.message.includes('rate limit') || 
            err.message.includes('timeout') ||
            err.message.includes('temporary')
          );
          
          if (!isRetryable) {
            results.failed.push({ topic, error: errors, attempts });
            break;
          }
        } else {
          log.info(`Webhook registered: ${topic} (attempt ${attempts})`);
          results.success.push({ topic, attempts });
          success = true;
        }
      } catch (error) {
        log.error(`Error registering webhook ${topic} (attempt ${attempts}/${maxAttempts})`, {
          error: error instanceof Error ? error.message : "Unknown error"
        });
        
        // Wait before retry (exponential backoff)
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
      }
    }
    
    if (!success) {
      results.failed.push({ topic, error: "Max attempts exceeded", attempts });
    }
  }
  
  // Log summary
  log.info("Webhook registration summary", {
    successful: results.success.length,
    failed: results.failed.length,
    total: requiredTopics.length
  });
  
  // Alert if critical webhooks failed
  if (results.failed.length > 0) {
    log.error("Critical webhook registration failures detected", {
      failedWebhooks: results.failed
    });
  }
  
  return results;
}