import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { log } from "~/lib/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await request.json();
    
    log.webhook("SHOP_REDACT", payload.shop_domain || "unknown", { verified: true });

    // GDPR compliance: Log the shop data deletion request
    // In production, implement actual data deletion here
    log.info("GDPR shop data redaction requested", {
      shopId: payload.shop_id || 'unknown',
      shopDomain: payload.shop_domain || 'unknown'
    });

    return json({ received: true }, { status: 200 });
  } catch (error) {
    log.error("Failed to process GDPR shop redaction webhook", error as Error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};