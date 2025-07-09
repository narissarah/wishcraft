import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { 
  verifyWebhookRequest, 
  logWebhookEvent, 
  validateWebhookTopic,
  checkWebhookRateLimit 
} from "~/lib/webhook-security.server";

/**
 * GDPR Webhook: Shop Redact
 * Triggered 48 hours after app uninstall
 * Must delete ALL shop data permanently
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("SHOP_REDACT", verification.shop || "unknown", null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "SHOP_REDACT")) {
    await logWebhookEvent("SHOP_REDACT", verification.shop || "unknown", null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop || "unknown", 5, 60000)) {
    await logWebhookEvent("SHOP_REDACT", verification.shop || "unknown", null, false, "Rate limit exceeded");
    throw new Response("Too Many Requests", { status: 429 });
  }

  const { shop, payload } = await authenticate.webhook(request);
  
  try {
    console.log(`🗑️ GDPR: Starting shop data deletion for ${shop}`);

    // Get shop data stats before deletion for logging
    const stats = await db.$transaction(async (tx) => {
      const registryCount = await tx.registry.count({ where: { shopId: shop } });
      const customerCount = await tx.registry.groupBy({
        by: ['customerId'],
        where: { shopId: shop }
      });
      const analyticsCount = await tx.analyticsEvent.count({ where: { shopId: shop } });
      
      return {
        registries: registryCount,
        customers: customerCount.length,
        analytics: analyticsCount
      };
    });

    // Perform complete data deletion
    // Using transaction to ensure atomicity
    await db.$transaction(async (tx) => {
      // The shop deletion will cascade to all related records
      // due to onDelete: Cascade in schema
      await tx.shop.delete({ 
        where: { id: shop } 
      });

      // Also clean up any orphaned session data
      await tx.session.deleteMany({
        where: { shop }
      });
    });

    // Log the deletion (this goes to a separate audit database/service)
    console.log(`✅ GDPR: Shop data deletion completed for ${shop}`, {
      deletedRecords: stats,
      deletedAt: new Date().toISOString(),
      webhookId: payload.webhook_id
    });

    // Send confirmation to external audit service
    const { auditService } = await import("~/lib/audit-service.server");
    await auditService.logGDPREvent("shop_redact", shop, {
      deletedRecords: stats,
      webhookId: payload.webhook_id,
      deletionComplete: true
    });
    
    await auditService.logShopEvent("data_deleted", shop, stats);

    await logWebhookEvent("SHOP_REDACT", shop, payload, true);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`❌ Error deleting shop data for ${shop}:`, error);
    await logWebhookEvent("SHOP_REDACT", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Queue retry job for critical GDPR compliance
    try {
      await db.systemJob.create({
        data: {
          type: "shop_data_deletion_retry",
          shopId: shop,
          payload: JSON.stringify({
            shop,
            error: error instanceof Error ? error.message : "Unknown error",
            attemptedAt: new Date().toISOString()
          }),
          priority: 1,
          runAt: new Date(Date.now() + 3600000) // Retry in 1 hour
        }
      });
    } catch (jobError) {
      console.error("Failed to queue retry job:", jobError);
    }

    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};