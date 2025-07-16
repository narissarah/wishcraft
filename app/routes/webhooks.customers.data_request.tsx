import { log } from "~/lib/logger.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";

/**
 * GDPR Webhook: Customer Data Request
 * Triggered when a customer requests their data
 * Must respond within 30 days with all customer data
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  
  if (!payload.customer?.id || !payload.customer?.email) {
    log.error("Invalid customer data in webhook payload");
    throw new Response("Bad request", { status: 400 });
  }

  try {
    // Queue data export job
    await db.systemJob.create({
      data: {
        type: "customer_data_export",
        shopId: shop,
        payload: JSON.stringify({
          customerId: payload.customer.id,
          customerEmail: payload.customer.email,
          shopDomain: payload.shop_domain,
          requestedAt: new Date().toISOString(),
          webhookId: payload.webhook_id,
        }),
        priority: 1, // High priority for GDPR compliance
        runAt: new Date(), // Process immediately
      },
    });

    // Log the request for audit trail
    await db.auditLog.create({
      data: {
        shopId: shop,
        action: "gdpr_data_request",
        resource: "customer",
        resourceId: payload.customer.id,
        metadata: JSON.stringify({
          email: payload.customer.email,
          requestedAt: new Date().toISOString(),
          webhookTopic: topic,
        }),
      },
    });

    log.info(`GDPR: Customer data request received for ${payload.customer.email} from shop ${shop}`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error("Error processing customer data request:", error as Error);
    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};