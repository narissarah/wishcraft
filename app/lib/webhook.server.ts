import { log } from "./logger.server";

export async function processWebhook(request: Request, topic: string) {
  try {
    // Dynamic import to avoid initialization issues
    const { shopify } = await import("~/shopify.server");
    const webhookContext = await shopify.authenticate.webhook(request);
    const { topic: webhookTopic, shop } = webhookContext;
    
    log.info("Processing webhook", { topic: webhookTopic, shop });
    
    // Process based on topic
    switch (webhookTopic) {
      case "APP_UNINSTALLED":
        // Cleanup handled by Shopify Remix package
        break;
      case "CUSTOMERS_DATA_REQUEST":
      case "CUSTOMERS_REDACT":
      case "SHOP_REDACT":
        // GDPR webhooks - already handled in specific routes
        break;
      default:
        log.info("Unhandled webhook topic", { topic: webhookTopic });
    }
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error("Webhook processing error", { error, topic });
    return new Response("Internal Server Error", { status: 500 });
  }
}