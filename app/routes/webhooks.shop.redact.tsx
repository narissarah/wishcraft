import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { log } from "~/lib/logger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ error: "Method not allowed" }, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate webhook - dynamic import to avoid initialization issues
    const { authenticate } = await import("~/shopify.server");
    const { shop, payload } = await authenticate.webhook(request);
    
    log.webhook("SHOP_REDACT", shop, { verified: true });

    // GDPR compliance: Log the shop data deletion request
    // In production, implement actual data deletion here
    log.info("GDPR shop data redaction requested", {
      shopId: shop,
      shopDomain: shop
    });

    return json({ received: true }, { status: 200 });
  } catch (error) {
    log.error("Failed to process GDPR shop redaction webhook", error as Error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};