import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { 
  verifyWebhookRequest, 
  logWebhookEvent, 
  validateWebhookTopic,
  checkWebhookRateLimit 
} from "~/lib/webhook-security.server";

/**
 * GDPR Webhook: Customer Redact
 * Triggered 10 days after customer data request
 * Must delete/anonymize customer personal data
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("CUSTOMERS_REDACT", verification.shop || "unknown", null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "CUSTOMERS_REDACT")) {
    await logWebhookEvent("CUSTOMERS_REDACT", verification.shop || "unknown", null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop || "unknown", 10, 60000)) {
    await logWebhookEvent("CUSTOMERS_REDACT", verification.shop || "unknown", null, false, "Rate limit exceeded");
    throw new Response("Too Many Requests", { status: 429 });
  }

  const { shop, payload } = await authenticate.webhook(request);
  
  if (!payload.customer?.id) {
    console.error("Invalid customer ID in webhook payload");
    await logWebhookEvent("CUSTOMERS_REDACT", shop, payload, false, "Invalid customer ID");
    throw new Response("Bad request", { status: 400 });
  }

  try {
    // Start transaction for data redaction
    await db.$transaction(async (tx) => {
      // 1. Anonymize customer data in registries
      const registries = await tx.registry.updateMany({
        where: { 
          shopId: shop,
          customerId: payload.customer.id 
        },
        data: { 
          status: "archived",
          customerEmail: "REDACTED@example.com",
          customerFirstName: "REDACTED",
          customerLastName: "REDACTED", 
          customerPhone: null,
          updatedAt: new Date()
        }
      });

      // 2. Anonymize registry activities
      await tx.registryActivity.updateMany({
        where: { 
          actorId: payload.customer.id,
          registry: { shopId: shop }
        },
        data: {
          actorEmail: "REDACTED@example.com",
          actorName: "REDACTED",
          actorIp: null
        }
      });

      // 3. Anonymize registry purchases
      await tx.registryPurchase.updateMany({
        where: { 
          purchaserId: payload.customer.id,
          registryItem: { registry: { shopId: shop } }
        },
        data: {
          purchaserEmail: "REDACTED@example.com",
          purchaserName: "REDACTED",
          purchaserPhone: null,
          giftMessage: null // Remove personal messages
        }
      });

      // 4. Anonymize group gift contributions
      await tx.groupGiftContribution.updateMany({
        where: { 
          contributorEmail: payload.customer.email || "",
          purchase: { registryItem: { registry: { shopId: shop } } }
        },
        data: {
          contributorEmail: "REDACTED@example.com",
          contributorName: "REDACTED",
          contributorMessage: null
        }
      });

      // 5. Remove collaborator records
      await tx.registryCollaborator.deleteMany({
        where: {
          email: payload.customer.email || "",
          registry: { shopId: shop }
        }
      });

      // 6. Remove invitations
      await tx.registryInvitation.deleteMany({
        where: {
          email: payload.customer.email || "",
          registry: { shopId: shop }
        }
      });

      // 7. Log the redaction
      await tx.auditLog.create({
        data: {
          action: "gdpr_customer_redact",
          resource: "customer",
          resourceId: payload.customer.id,
          shopId: shop,
          metadata: JSON.stringify({
            redactedAt: new Date().toISOString(),
            dataTypes: [
              "registries",
              "activities", 
              "purchases",
              "contributions",
              "collaborations",
              "invitations"
            ],
            registriesAffected: registries.count
          })
        }
      });
    });

    // 8. Log to external audit service
    const { auditService } = await import("~/lib/audit-service.server");
    await auditService.logGDPREvent("customer_redact", shop, {
      customerId: payload.customer.id,
      customerEmail: payload.customer.email,
      dataTypes: [
        "registries",
        "activities", 
        "purchases",
        "contributions",
        "collaborations",
        "invitations"
      ],
      recordsAffected: registries.count,
      webhookId: payload.webhook_id
    });

    console.log(`🔒 GDPR: Customer data redacted for ${payload.customer.id} from shop ${shop}`);
    await logWebhookEvent("CUSTOMERS_REDACT", shop, payload, true);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error redacting customer data:", error);
    await logWebhookEvent("CUSTOMERS_REDACT", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};