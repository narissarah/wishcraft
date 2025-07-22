import crypto from "crypto";
import type { ActionFunctionArgs } from "@remix-run/node";
import { createWebhookHandler } from "~/lib/webhook.server";
import { apiResponse } from "~/lib/api-response.server";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

/**
 * Customers Create Webhook - Consolidated Pattern
 */
const handler = createWebhookHandler(
  {
    topic: "customers.create",
    requireAuth: true,
    rateLimit: { max: 30, windowMs: 60000 }
  },
  async ({ shop, payload, admin }) => {
    if (!admin) {
      throw new Error("No admin context available");
    }

    const customer = payload;
    
    log.webhook("CUSTOMERS_CREATE", shop, {
      customerId: customer.id,
      email: customer.email,
    });

    // Create audit log entry
    await db.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        shopId: shop,
        userId: customer.id,
        userEmail: customer.email,
        action: "CUSTOMER_CREATED",
        resource: "customer", 
        resourceId: customer.id,
        metadata: JSON.stringify({
          firstName: customer.first_name,
          lastName: customer.last_name,
          acceptsMarketing: customer.accepts_marketing,
        }),
      },
    });
    
    return apiResponse.success({ received: true });
  }
);

export const action = handler;