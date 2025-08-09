import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await request.json();
    const customerId = payload.customer?.id;
    const customerEmail = payload.customer?.email;
    const shop = payload.shop_domain;
    
    log.webhook("CUSTOMERS_REDACT", shop || "unknown", { 
      customerId: customerId?.substring(0, 8) + '****' || 'unknown'
    });

    if (!customerId || !customerEmail || !shop) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // GDPR compliance: Anonymize customer data
    await db.$transaction(async (tx) => {
      // Anonymize registries
      await tx.registries.updateMany({
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

      // Anonymize purchases
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
    });

    log.info("GDPR customer data redaction completed", {
      customerId: customerId.substring(0, 8) + '****',
      shopId: shop
    });

    return json({ received: true }, { status: 200 });
  } catch (error) {
    log.error("Failed to process customer redaction webhook", error as Error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};