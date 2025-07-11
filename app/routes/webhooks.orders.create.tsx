import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";
import { 
  verifyWebhookRequest, 
  logWebhookEvent, 
  validateWebhookTopic,
  checkWebhookRateLimit 
} from "~/lib/webhook-security.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature first
  const verification = await verifyWebhookRequest(request.clone());
  
  if (!verification.isValid) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop ?? "unknown", null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "ORDERS_CREATE")) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop ?? "unknown", null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop ?? "unknown", 20, 60000)) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop ?? "unknown", null, false, "Rate limit exceeded");
    throw new Response("Too Many Requests", { status: 429 });
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "ORDERS_CREATE") {
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, "No admin context");
    throw new Response("Unauthorized", { status: 401 });
  }

  log.webhook("ORDERS_CREATE", shop, { verified: true });

  const order = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  try {
    // Process order items that might be registry purchases
    for (const item of order.line_items || []) {
      // Check if this is a registry purchase via line item properties
      const registryId = item.properties?.find((p: any) => p.name === '_registry_id')?.value;
      
      if (registryId) {
        // Create purchase record
        const purchase = await db.registryPurchase.create({
          data: {
            registryId,
            productId: item.product_id?.toString() || '',
            variantId: item.variant_id?.toString(),
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.price) || 0,
            totalAmount: (parseFloat(item.price) || 0) * (item.quantity || 1),
            currencyCode: order.currency || 'USD',
            orderId: order.id.toString(),
            orderName: order.name,
            purchaserEmail: order.email || order.customer?.email || '',
            status: 'confirmed'
          }
        });

        // Update registry purchased value
        const itemPrice = parseFloat(item.price) * item.quantity;
        await db.registry.update({
          where: { id: registryId },
          data: {
            purchasedValue: {
              increment: itemPrice
            }
          }
        });

        // Log the purchase
        await db.auditLog.create({
          data: {
            action: 'registry_purchase',
            resource: 'order',
            resourceId: order.id.toString(),
            shopId: shop,
            metadata: JSON.stringify({
              registryId,
              purchaseId: purchase.id,
              itemTitle: item.title,
              quantity: item.quantity,
              amount: itemPrice,
              purchaserEmail: purchase.purchaserEmail
            })
          }
        });

        log.info(`Recorded registry purchase for registry ${registryId}`, {
          registryId,
          purchaseId: purchase.id,
          orderId: order.id.toString(),
          amount: itemPrice
        });
      }
    }

    await logWebhookEvent("ORDERS_CREATE", shop, payload, true);
    return new Response("OK", { status: 200 });
  } catch (error) {
    log.error(`Error processing order webhook for ${shop}`, error as Error, { 
      shop,
      orderId: order.id?.toString() 
    });
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};