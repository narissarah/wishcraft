import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { log } from "~/lib/logger.server";

/**
 * Creates a standardized webhook handler with common error handling and logging
 */
export async function createWebhookHandler(
  webhookType: string,
  handler: (shop: string, payload: any) => Promise<void>
) {
  return async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, { status: 405 });
    }
    
    try {
      const { shop, payload } = await authenticate.webhook(request);
      log.webhook(webhookType, shop, { verified: true });
      await handler(shop, payload);
      return json({ received: true }, { status: 200 });
    } catch (error) {
      log.error(`Failed to process ${webhookType} webhook`, error as Error);
      return json({ error: "Webhook processing failed" }, { status: 500 });
    }
  };
}

/**
 * Standard webhook response for successful processing
 */
export function webhookSuccess() {
  return json({ received: true }, { status: 200 });
}

/**
 * Standard webhook response for errors
 */
export function webhookError(message = "Webhook processing failed", status = 500) {
  return json({ error: message }, { status });
}