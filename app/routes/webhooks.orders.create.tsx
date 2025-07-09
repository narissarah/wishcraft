import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { publishOrderCreated, publishItemPurchased, publishWebhookReceived } from "~/lib/graphql-subscriptions.server";
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
    await logWebhookEvent("ORDERS_CREATE", verification.shop || "unknown", null, false, "Invalid HMAC signature");
    throw new Response("Unauthorized - Invalid HMAC signature", { status: 401 });
  }

  // Validate webhook topic
  if (!validateWebhookTopic(verification.topic, "ORDERS_CREATE")) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop || "unknown", null, false, "Invalid topic");
    throw new Response("Bad Request - Invalid topic", { status: 400 });
  }

  // Rate limiting
  if (!checkWebhookRateLimit(verification.shop || "unknown", 20, 60000)) {
    await logWebhookEvent("ORDERS_CREATE", verification.shop || "unknown", null, false, "Rate limit exceeded");
    throw new Response("Too Many Requests", { status: 429 });
  }

  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "ORDERS_CREATE") {
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, "No admin context");
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`✅ Received verified ORDERS_CREATE webhook for ${shop}`);

  const order = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  try {
    // Publish webhook received event for real-time monitoring
    await publishWebhookReceived(shop, { topic, data: order });

    // Check if order contains registry items
    const registryItems = order.line_items?.filter((item: any) => 
      item.properties?.some((prop: any) => 
        prop.name === '_registry_id' || prop.name === '_registry_item_id'
      )
    ) || [];

    if (registryItems.length > 0) {
      // Process registry purchases
      for (const item of registryItems) {
        const registryId = item.properties?.find((p: any) => p.name === '_registry_id')?.value;
        const registryItemId = item.properties?.find((p: any) => p.name === '_registry_item_id')?.value;
        const isGift = item.properties?.find((p: any) => p.name === '_gift_purchase')?.value === 'true';

        if (registryId && registryItemId) {
          // Create purchase record
          const purchase = await db.registryPurchase.create({
            data: {
              registryItemId,
              orderId: order.id,
              lineItemId: item.id,
              orderName: order.name,
              quantity: item.quantity,
              unitPrice: parseFloat(item.price),
              totalAmount: parseFloat(item.price) * item.quantity,
              currencyCode: order.currency,
              purchaserType: order.customer ? 'customer' : 'guest',
              purchaserId: order.customer?.id,
              purchaserEmail: order.email || order.customer?.email,
              purchaserName: order.customer ? 
                `${order.customer.first_name} ${order.customer.last_name}` : 
                null,
              isGift,
              status: 'confirmed',
              paymentStatus: order.financial_status === 'paid' ? 'paid' : 'pending',
              fulfillmentStatus: 'unfulfilled'
            }
          });

          // Update registry item purchased quantity
          await db.registryItem.update({
            where: { id: registryItemId },
            data: {
              quantityPurchased: {
                increment: item.quantity
              }
            }
          });

          // Get registry for real-time update
          const registryItem = await db.registryItem.findUnique({
            where: { id: registryItemId },
            include: { registry: true }
          });

          if (registryItem) {
            // Publish real-time events
            await publishItemPurchased(
              shop,
              registryId,
              registryItemId,
              item.quantity,
              order.customer?.email || 'guest',
              order.id
            );

            // Log activity
            await db.registryActivity.create({
              data: {
                registryId,
                type: 'item_purchased',
                description: `${item.quantity}x ${item.title} purchased`,
                actorType: order.customer ? 'customer' : 'guest',
                actorId: order.customer?.id,
                actorEmail: order.email || order.customer?.email,
                actorName: order.customer ? 
                  `${order.customer.first_name} ${order.customer.last_name}` : 
                  'Guest',
                metadata: JSON.stringify({
                  orderId: order.id,
                  orderName: order.name,
                  lineItemId: item.id,
                  quantity: item.quantity,
                  price: item.price
                })
              }
            });
          }
        }
      }
    }

    // Publish general order created event
    await publishOrderCreated(shop, {
      id: order.id,
      name: order.name,
      totalPrice: parseFloat(order.total_price),
      lineItems: order.line_items?.map((item: any) => ({
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity,
        price: parseFloat(item.price)
      })) || [],
      customer: order.customer ? {
        id: order.customer.id,
        name: `${order.customer.first_name} ${order.customer.last_name}`,
        email: order.customer.email
      } : {
        id: 'guest',
        name: 'Guest',
        email: order.email
      }
    });

    console.log(`✅ Order ${order.name} processed successfully`);
    await logWebhookEvent("ORDERS_CREATE", shop, payload, true);
    return new Response("OK", { status: 200 });
    
  } catch (error) {
    console.error(`❌ Error processing order ${order.name}:`, error);
    await logWebhookEvent("ORDERS_CREATE", shop, payload, false, error instanceof Error ? error.message : "Unknown error");
    
    // Queue retry job for critical order processing
    try {
      await db.systemJob.create({
        data: {
          type: "order_processing_retry",
          shopId: shop,
          payload: JSON.stringify({
            orderId: order.id,
            orderName: order.name,
            error: error instanceof Error ? error.message : "Unknown error",
            attemptedAt: new Date().toISOString()
          }),
          priority: 1,
          runAt: new Date(Date.now() + 60000) // Retry in 1 minute
        }
      });
    } catch (jobError) {
      console.error("Failed to queue retry job:", jobError);
    }

    // Still return 200 to prevent webhook retry storms
    return new Response("OK", { status: 200 });
  }
};