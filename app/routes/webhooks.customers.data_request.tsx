import crypto from "crypto";import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { createGDPRJob } from "~/lib/utils.server";
import { log } from "~/lib/logger.server";

/**
 * GDPR Webhook: Customer Data Request - Consolidated Pattern
 * Triggered when a customer requests their data
 * Must respond within 30 days with all customer data
 */
const handler = createWebhookHandler(
  {
    topic: "customers.data_request",
    requireAuth: false, // GDPR webhooks don't require auth
    rateLimit: { max: 10, windowMs: 60000 }
  },
  async ({ shop, payload }) => {
    log.webhook("CUSTOMERS_DATA_REQUEST", shop, { verified: true });

    if (!payload.customer?.id || !payload.customer?.email) {
      throw new Error("Invalid customer data in webhook payload");
    }

    try {
      // Queue high-priority GDPR data export job
      const job = await createGDPRJob({
        type: 'customer_data_export',
        shopId: shop,
        customerId: payload.customer.id,
        metadata: {
          customerEmail: payload.customer.email,
          shopDomain: payload.shop_domain,
          requestedAt: new Date().toISOString(),
          webhookId: payload.webhook_id,
          ordersToRedact: payload.orders_to_redact || [],
          customFields: payload.custom_fields || {}
        }
      });

      log.info("GDPR customer data export job queued", {
        jobId: job.id,
        customerId: payload.customer.id.substring(0, 8) + '****',
        customerEmail: payload.customer.email.substring(0, 3) + '****',
        shopId: shop
      });

      return apiResponse.success({ received: true, jobId: job.id });
    } catch (error) {
      log.error("Failed to queue GDPR data export job", error as Error, {
        customerId: payload.customer.id.substring(0, 8) + '****',
        shopId: shop
      });
      throw error;
    }
  }
);

export const action = handler;