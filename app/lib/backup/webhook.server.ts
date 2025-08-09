/**
 * Simplified Webhook Utilities for WishCraft
 * Basic HMAC verification - no factory patterns
 */

import crypto from "crypto";

/**
 * Verify Shopify webhook HMAC signature
 */
export function verifyWebhookHMAC(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const computedHmac = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("base64");

    const providedHmac = Buffer.from(signature, "base64");
    const computedHmacBuffer = Buffer.from(computedHmac, "base64");

    if (providedHmac.length !== computedHmacBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedHmac, computedHmacBuffer);
  } catch (error) {
    console.error("Error verifying HMAC signature:", error);
    return false;
  }
}

/**
 * Log webhook event for debugging
 */
export function logWebhookEvent(topic: string, shop: string, data?: any) {
  console.log(`Webhook ${topic} from ${shop}`, data);
}

/**
 * Simple webhook handler wrapper
 */
export function createWebhookHandler(
  config: { topic: string; requireAuth?: boolean; rateLimit?: { max: number; windowMs: number } },
  handler: (params: { shop: string; payload: any; admin?: any }) => Promise<any>
) {
  return async (request: Request) => {
    try {
      const payload = await request.text();
      const signature = request.headers.get("X-Shopify-Hmac-Sha256");
      const shop = request.headers.get("X-Shopify-Shop-Domain") || "";
      
      // Verify webhook signature if we have a secret
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      if (webhookSecret && !verifyWebhookHMAC(payload, signature, webhookSecret)) {
        return new Response("Unauthorized", { status: 401 });
      }
      
      const data = JSON.parse(payload);
      const result = await handler({ shop, payload: data, admin: null });
      
      return result instanceof Response ? result : new Response("OK");
    } catch (error) {
      console.error("Webhook handler error:", error);
      return new Response("Error", { status: 500 });
    }
  };
}

/**
 * Process webhook with basic validation
 */
export async function processWebhook(request: Request, topic: string) {
  const payload = await request.text();
  const signature = request.headers.get("X-Shopify-Hmac-Sha256");
  const shop = request.headers.get("X-Shopify-Shop-Domain") || "";
  
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (webhookSecret && !verifyWebhookHMAC(payload, signature, webhookSecret)) {
    throw new Response("Unauthorized", { status: 401 });
  }
  
  const data = JSON.parse(payload);
  logWebhookEvent(topic, shop, data);
  
  return { shop, payload: data };
}