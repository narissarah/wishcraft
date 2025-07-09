import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";

/**
 * GDPR Webhook: Shop Redact
 * Triggered 48 hours after app uninstall
 * Must delete ALL shop data permanently
 */
export const action = async ({ request }: ActionFunctionArgs) => {
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

    // Optional: Send confirmation to external audit service
    if (process.env.AUDIT_SERVICE_URL) {
      await fetch(process.env.AUDIT_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'shop_data_deleted',
          shopDomain: shop,
          deletedAt: new Date().toISOString(),
          recordStats: stats
        })
      }).catch(err => console.error("Failed to log to audit service:", err));
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`❌ Error deleting shop data for ${shop}:`, error);
    
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