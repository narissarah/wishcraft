import { createWebhookHandler } from "~/lib/webhook-utils.server";
import { log } from "~/lib/logger.server";

export const action = createWebhookHandler("APP_UNINSTALLED", async (shop, payload) => {
  // Log the uninstall for compliance
  log.info("App uninstalled", {
    shopId: shop,
    uninstalledAt: new Date().toISOString()
  });

  // In production, implement cleanup logic here:
  // - Archive user data
  // - Cancel subscriptions
  // - Schedule data deletion per GDPR
});