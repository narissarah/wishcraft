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
 * Must delete all shop data
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("SHOP_REDACT", verification.shop, null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "SHOP_REDACT")) {
    await logWebhookEvent("SHOP_REDACT", verification.shop, null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "SHOP_REDACT") {
    await logWebhookEvent("SHOP_REDACT", shop, payload, false, "No admin context");
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`🗑️ Received verified SHOP_REDACT webhook for ${shop}`);

  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  try {
    // Delete all shop data in transaction
    await db.$transaction(async (tx) => {
      // Count records before deletion for logging
      const registryCount = await tx.registry.count({ where: { shopId: shop } });
      const purchaseCount = await tx.registryPurchase.count({ 
        where: { registry: { shopId: shop } } 
      });
      const auditLogCount = await tx.auditLog.count({ where: { shopId: shop } });
      
      // Delete in correct order (respecting foreign key constraints)
      await tx.registryPurchase.deleteMany({
        where: { registry: { shopId: shop } }
      });
      
      await tx.registryItem.deleteMany({
        where: { registry: { shopId: shop } }
      });
      
      await tx.registry.deleteMany({
        where: { shopId: shop }
      });
      
      await tx.auditLog.deleteMany({
        where: { shopId: shop }
      });
      
      await tx.systemJob.deleteMany({
        where: { shopId: shop }
      });
      
      await tx.shopSettings.deleteMany({
        where: { shopId: shop }
      });
      
      await tx.shop.delete({
        where: { id: shop }
      });
      
      console.log(`✅ Deleted all data for shop ${shop}:`, {
        registries: registryCount,
        purchases: purchaseCount,
        auditLogs: auditLogCount
      });
    });

    // Log the redaction completion (outside transaction since shop is deleted)
    console.log(`🔒 Shop data redaction completed for ${shop}`);

    await logWebhookEvent("SHOP_REDACT", shop, payload, true);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`❌ Error processing shop redact webhook for ${shop}:`, error);
    await logWebhookEvent("SHOP_REDACT", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};