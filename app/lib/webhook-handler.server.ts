/**
 * Unified Webhook Handler for Shopify
 * Built for Shopify 2025 Compliance
 */

import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { verifyWebhookRequest, validateWebhookTopic, checkWebhookRateLimit, logWebhookEvent } from "~/lib/webhook-security.server";
import { getCircuitBreaker } from "~/lib/circuit-breaker.server";

export interface WebhookHandler<T = any> {
  topic: string;
  handler: (data: T, shop: string) => Promise<void>;
  required?: boolean;
}

// Registry of webhook handlers
const webhookHandlers = new Map<string, WebhookHandler>();

/**
 * Register a webhook handler
 */
export function registerWebhookHandler<T = any>(handler: WebhookHandler<T>) {
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
  const handler = webhookHandlers.get(topic || "");
  if (!handler) {
    log.warn(`No handler registered for webhook topic: ${topic}`);
    await logWebhookEvent(topic || "unknown", shop, null, false, "No handler found");
    return json({ error: "Handler not found" }, { status: 404 });
  }
  
  // Use circuit breaker for webhook processing
  const circuitBreaker = getCircuitBreaker(`webhook-${topic}`, {
    failureThreshold: 5,
    resetTimeout: 60000,
    requestTimeout: 30000
  });
  
  try {
    const data = JSON.parse(verification.payload);
    
    await circuitBreaker.execute(async () => {
      await handler.handler(data, shop!);
    });
    
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

// Built-in webhook handlers
registerWebhookHandler({
  topic: "app/uninstalled",
  handler: async (data: any, shop: string) => {
    log.info(`App uninstalled for shop: ${shop}`);
    
    // Mark shop as inactive
    await db.shop.update({
      where: { id: shop },
      data: {
        settings: {
          update: {
            appActive: false,
            appUninstalledAt: new Date()
          }
        }
      }
    });
    
    // Clean up sessions
    await db.session.deleteMany({
      where: { shop }
    });
  },
  required: true
});

registerWebhookHandler({
  topic: "customers/redact",
  handler: async (data: any, shop: string) => {
    const { customer } = data;
    log.info(`Customer redact request for shop: ${shop}`, { customerId: customer.id });
    
    // GDPR: Redact customer data
    await db.registry.updateMany({
      where: {
        shopId: shop,
        customerId: customer.id
      },
      data: {
        customerEmail: "[REDACTED]",
        customerFirstName: "[REDACTED]",
        customerLastName: "[REDACTED]",
        customerEmailHash: null
      }
    });
  },
  required: true
});

registerWebhookHandler({
  topic: "shop/redact",
  handler: async (data: any, shop: string) => {
    log.info(`Shop redact request for shop: ${shop}`);
    
    // GDPR: Delete all shop data after grace period
    // In production, you might want to schedule this for later
    await db.shop.delete({
      where: { id: shop }
    });
  },
  required: true
});

registerWebhookHandler({
  topic: "products/update",
  handler: async (data: any, shop: string) => {
    const { id, title, status, variants } = data;
    
    // Update registry items with new product info
    await db.registryItem.updateMany({
      where: {
        productId: id,
        registry: { shopId: shop }
      },
      data: {
        productTitle: title,
        status: status === "active" ? "active" : "out_of_stock"
      }
    });
    
    // Update variant info if needed
    for (const variant of variants || []) {
      await db.registryItem.updateMany({
        where: {
          variantId: variant.id,
          registry: { shopId: shop }
        },
        data: {
          price: parseFloat(variant.price),
          inventoryQuantity: variant.inventory_quantity,
          inventoryTracked: variant.inventory_management !== null
        }
      });
    }
  }
});

registerWebhookHandler({
  topic: "orders/paid",
  handler: async (data: any, shop: string) => {
    const { id, line_items, customer } = data;
    
    // Check if any line items are registry purchases
    for (const item of line_items) {
      if (item.properties?.registry_id) {
        await db.registryPurchase.create({
          data: {
            registryId: item.properties.registry_id,
            orderId: id,
            lineItemId: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            unitPrice: parseFloat(item.price),
            totalAmount: parseFloat(item.price) * item.quantity,
            currencyCode: data.currency,
            purchaserEmail: customer?.email,
            purchaserName: customer ? `${customer.first_name} ${customer.last_name}` : null,
            status: "confirmed"
          }
        });
        
        // Update registry purchased value
        await db.registry.update({
          where: { id: item.properties.registry_id },
          data: {
            purchasedValue: {
              increment: parseFloat(item.price) * item.quantity
            }
          }
        });
      }
    }
  }
});

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
  const results = { success: [], failed: [] };
  
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
          const isRetryable = errors.some(err => 
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