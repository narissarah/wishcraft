import crypto from "crypto";

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
    console.error("❌ Missing HMAC signature in webhook request");
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
      console.error("❌ HMAC signature length mismatch");
      return false;
    }

    const isValid = crypto.timingSafeEqual(providedHmac, computedHmacBuffer);
    
    if (!isValid) {
      console.error("❌ Invalid HMAC signature for webhook");
    } else {
      console.log("✅ Webhook HMAC signature verified successfully");
    }

    return isValid;
  } catch (error) {
    console.error("❌ Error verifying HMAC signature:", error);
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
  
  const payload = await request.text();
  
  if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
    console.error("❌ SHOPIFY_WEBHOOK_SECRET environment variable not set");
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
      console.error(`❌ Webhook HMAC verification failed for ${request.url}`);
      throw new Response("Unauthorized - Invalid HMAC signature", { 
        status: 401,
        headers: {
          "Content-Type": "text/plain",
          "X-Webhook-Error": "Invalid HMAC signature"
        }
      });
    }

    console.log(`✅ Webhook HMAC verified for topic: ${verification.topic}, shop: ${verification.shop}`);
    
    // Call original handler with verified request
    return handler(...args);
  }) as T;
}

/**
 * Log webhook event for audit purposes
 */
export async function logWebhookEvent(
  topic: string,
  shop: string,
  payload: any,
  success: boolean,
  error?: string
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    topic,
    shop,
    success,
    error,
    payloadSize: JSON.stringify(payload).length,
    environment: process.env.NODE_ENV
  };

  console.log(`📝 Webhook Event Log:`, logEntry);

  // You can extend this to write to database or external logging service
  // await db.auditLog.create({ data: logEntry });
}

/**
 * Validate webhook topic
 */
export function validateWebhookTopic(topic: string | null, expectedTopic: string): boolean {
  if (!topic) {
    console.error(`❌ Missing webhook topic header, expected: ${expectedTopic}`);
    return false;
  }

  if (topic !== expectedTopic) {
    console.error(`❌ Invalid webhook topic: ${topic}, expected: ${expectedTopic}`);
    return false;
  }

  return true;
}

/**
 * Rate limit webhook requests (basic implementation)
 */
const webhookRateLimit = new Map<string, { count: number; resetAt: number }>();

export function checkWebhookRateLimit(shop: string, maxRequests = 10, windowMs = 60000): boolean {
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

  if (limit.count > maxRequests) {
    console.warn(`⚠️ Webhook rate limit exceeded for shop: ${shop}`);
    return false;
  }

  return true;
}