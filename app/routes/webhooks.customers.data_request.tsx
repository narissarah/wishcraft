import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { log } from "~/lib/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate webhook
    const { shop, payload } = await authenticate.webhook(request);
    
    log.webhook("CUSTOMERS_DATA_REQUEST", shop, { 
      customerId: payload.customer?.id?.substring(0, 8) + '****' || 'unknown'
    });

    // GDPR compliance: Log the data request
    // In production, implement actual data export here
    log.info("GDPR customer data export requested", {
      customerId: payload.customer?.id?.substring(0, 8) + '****' || 'unknown',
      customerEmail: payload.customer?.email?.substring(0, 3) + '****' || 'unknown',
      shopId: shop
    });

    return json({ received: true }, { status: 200 });
  } catch (error) {
    log.error("Failed to process GDPR data request webhook", error as Error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};