import crypto from "crypto";import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { createGDPRJob } from "~/lib/utils.server";
import { log } from "~/lib/logger.server";

/**
 * GDPR Webhook: Shop Data Redaction - Consolidated Pattern
 * Triggered when a shop uninstalls the app - all data must be deleted
 */
const handler = createWebhookHandler(
  {
    topic: "shop.redact",
    requireAuth: false, // GDPR webhooks don't require auth
    rateLimit: { max: 5, windowMs: 60000 }
  },
  async ({ shop, payload }) => {
    log.webhook("SHOP_REDACT", shop, { verified: true });

    try {
      // Queue high-priority GDPR shop data deletion job
      const job = await createGDPRJob({
        type: 'shop_data_redact',
        shopId: shop,
        metadata: {
          shopDomain: payload.shop_domain,
          requestedAt: new Date().toISOString(),
          webhookId: payload.webhook_id
        }
      });

      log.info("GDPR shop data redaction job queued", {
        jobId: job.id,
        shopId: shop,
        shopDomain: payload.shop_domain
      });

      return apiResponse.success({ received: true, jobId: job.id });
    } catch (error) {
      log.error("Failed to queue GDPR shop redaction job", error as Error, {
        shopId: shop,
        shopDomain: payload.shop_domain
      });
      throw error;
    }
  }
);

export const action = handler;