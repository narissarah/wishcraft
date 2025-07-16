import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { verifyWebhookRequest, logWebhookEvent, validateWebhookTopic, checkWebhookRateLimit } from "~/lib/webhook-security.server";
import { log } from "~/lib/logger.server";

/**
 * GDPR Webhook: Customer Redact
 * Triggered 10 days after customer data request
 * Must delete/anonymize customer personal data
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("CUSTOMERS_REDACT", verification.shop, null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "CUSTOMERS_REDACT")) {
    await logWebhookEvent("CUSTOMERS_REDACT", verification.shop, null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop, 10, 60000)) {
    await logWebhookEvent("CUSTOMERS_REDACT", verification.shop, null, false, "Rate limit exceeded");
    throw new Response("Too Many Requests", { status: 429 });
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "CUSTOMERS_REDACT") {
    await logWebhookEvent("CUSTOMERS_REDACT", shop, payload, false, "No admin context");
    throw new Response("Unauthorized", { status: 401 });
  }

  log.info(`Received verified CUSTOMERS_REDACT webhook for ${shop}`);

  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const customerId = data.customer.id;
  const customerEmail = data.customer.email;
  
  log.info(`Redacting customer data for ${customerEmail} (${customerId})`);

  try {
    await db.$transaction(async (tx) => {
      // 1. Anonymize registries owned by this customer
      const registriesToAnonymize = await tx.registry.updateMany({
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
      await tx.registryPurchase.updateMany({
        where: {
          purchaserEmail: customerEmail,
          registry: {
            shopId: shop
          }
        },
        data: {
          purchaserEmail: `redacted_${Date.now()}@example.com`
        }
      });

      log.info(`Anonymized ${registriesToAnonymize.count} registries for customer ${customerId}`);
    });

    // Log the redaction
    await db.auditLog.create({
      data: {
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

    await logWebhookEvent("CUSTOMERS_REDACT", shop, payload, true);
    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error(`Error processing customer redact webhook for ${shop}`, error as Error);
    await logWebhookEvent("CUSTOMERS_REDACT", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};