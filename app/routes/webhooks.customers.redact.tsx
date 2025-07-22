import crypto from "crypto";import type { ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { createWebhookHandler } from "~/lib/webhook.server";
import { log } from "~/lib/logger.server";

/**
 * GDPR Webhook: Customer Redact - Refactored with centralized handler
 * Triggered 10 days after customer data request
 * Must delete/anonymize customer personal data
 */
const handler = createWebhookHandler(
  {
    topic: "customers.redact",
    requireAuth: true,
    rateLimit: { max: 10, windowMs: 60000 }
  },
  async ({ shop, payload }) => {
    log.info(`Received verified CUSTOMERS_REDACT webhook for ${shop}`);

  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const customerId = data.customer.id;
  const customerEmail = data.customer.email;
  
  log.info(`Redacting customer data for ${customerEmail} (${customerId})`);

  try {
    await db.$transaction(async (tx) => {
      // 1. Anonymize registries owned by this customer
      const registriesToAnonymize = await tx.registries.updateMany({
        where: { 
          customerId: customerId,
          shopId: shop
        },
        data: {
          customerEmail: `redacted_${Date.now()}@example.com`,
          customerFirstName: "REDACTED",
          customerLastName: "REDACTED",
          customerId: `redacted_${customerId}`
        }
      });

      // 2. Anonymize purchases made by this customer
      await tx.registry_purchases.updateMany({
        where: {
          purchaserEmail: customerEmail,
          registry_items: {
            registries: {
              shopId: shop
            }
          }
        },
        data: {
          purchaserEmail: `redacted_${Date.now()}@example.com`
        }
      });

      log.info(`Anonymized ${registriesToAnonymize.count} registries for customer ${customerId}`);
    });

    // Log the redaction
    await db.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "customer_data_redacted",
        resource: "customer",
        resourceId: customerId,
        shopId: shop,
        metadata: JSON.stringify({
          redactedAt: new Date().toISOString(),
          customerEmail: customerEmail,
          webhookId: data.webhook_id,
          dataRequestId: data.data_request?.id
        })
      }
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error(`Error processing customer redact webhook for ${shop}`, error as Error);
    
    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
  }
);

export const action = async ({ request }: ActionFunctionArgs) => {
  return handler(request);
};