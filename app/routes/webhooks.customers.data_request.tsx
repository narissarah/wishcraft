import crypto from "crypto";
import type { ActionFunctionArgs } from "@remix-run/node";
import { apiResponse } from "~/lib/api-response.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { log } from "~/lib/logger.server";
import { exportCustomerData } from "~/lib/gdpr-simple.server";

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
      // GDPR: Handle customer data request directly
      log.info("GDPR customer data export requested", {
        customerId: payload.customer.id.substring(0, 8) + '****',
        customerEmail: payload.customer.email.substring(0, 3) + '****',
        shopId: shop,
        ordersToRedact: payload.orders_to_redact?.length || 0,
        requestedAt: new Date().toISOString()
      });

      // Export customer data from registries - GDPR Compliance
      const customerData = await exportCustomerData({
        shopId: shop,
        customerId: payload.customer.id,
        customerEmail: payload.customer.email,
        ordersToRedact: payload.orders_to_redact || []
      });

      // In a real implementation, you would:
      // 1. Create a secure download link
      // 2. Send email to customer with download link
      // 3. Set expiration date (typically 30 days)
      // 4. Log the request for compliance tracking
      
      log.info("GDPR customer data export completed", {
        customerId: payload.customer.id.substring(0, 8) + '****',
        recordsExported: customerData.recordCount,
        exportSize: customerData.sizeBytes
      });

      return apiResponse.success({ 
        received: true, 
        processed: true,
        exportId: customerData.exportId,
        recordCount: customerData.recordCount
      });
    } catch (error) {
      log.error("Failed to process GDPR data export request", error as Error, {
        customerId: payload.customer.id.substring(0, 8) + '****',
        shopId: shop
      });
      throw error;
    }
  }
);

export const action = handler;