import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { log } from "~/lib/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate webhook
    const { shop } = await authenticate.webhook(request);
    
    log.webhook("APP_UNINSTALLED", shop, { verified: true });

    // Log the uninstall for compliance
    log.info("App uninstalled", {
      shopId: shop,
      uninstalledAt: new Date().toISOString()
    });

    // In production, implement cleanup logic here:
    // - Archive user data
    // - Cancel subscriptions
    // - Schedule data deletion per GDPR

    return json({ received: true }, { status: 200 });
  } catch (error) {
    log.error("Failed to process app uninstall webhook", error as Error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};