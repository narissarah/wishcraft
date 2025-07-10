import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "CUSTOMERS_CREATE") {
    throw new Response("Unauthorized", { status: 401 });
  }

  const customer = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  log.webhook("CUSTOMERS_CREATE", shop, {
    customerId: customer.id,
    email: customer.email,
  });

  try {
    // Create customer profile in database
    await db.auditLog.create({
      data: {
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

    // Note: Email sending would be handled by a separate email service
    // This webhook just logs the customer creation for now
    
    return new Response(null, { status: 200 });
  } catch (error) {
    log.error("Failed to process customer creation webhook", error, {
      shop,
      customerId: customer.id,
    });
    
    // Return 200 to prevent webhook retry on transient errors
    return new Response(null, { status: 200 });
  }
};