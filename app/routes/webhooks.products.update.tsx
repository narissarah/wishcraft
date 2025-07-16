import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import { log } from "~/lib/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // CRITICAL SECURITY: Verify webhook HMAC signature before processing
  let shop: string;
  let payload: any;
  
  try {
    const { topic, shop: webhookShop, session, admin, payload: webhookPayload } = await authenticate.webhook(
      request,
    );
    
    shop = webhookShop;
    payload = webhookPayload;

    // Additional security: Verify topic matches expected webhook
    if (topic !== "PRODUCTS_UPDATE") {
      log.warn("Webhook topic mismatch", { expected: "PRODUCTS_UPDATE", received: topic, shop });
      throw new Response("Invalid webhook topic", { status: 400 });
    }

    if (!admin && topic === "PRODUCTS_UPDATE") {
      log.error("Webhook authentication failed", { topic, shop });
      throw new Response("Unauthorized", { status: 401 });
    }
  } catch (error) {
    log.error("Webhook verification failed", error as Error, { 
      url: request.url, 
      headers: Object.fromEntries(request.headers.entries()) 
    });
    throw new Response("Webhook verification failed", { status: 401 });
  }

  log.webhook("PRODUCTS_UPDATE", shop, { verified: true });

  const product = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  // Process product updates for gift registry functionality
  try {
    // Update registry items that reference this product
    await db.registryItem.updateMany({
      where: {
        productId: `gid://shopify/Product/${product.id}`,
        registry: {
          shopId: shop
        }
      },
      data: {
        productTitle: product.title,
        productHandle: product.handle,
        productImage: product.images?.edges?.[0]?.node?.originalSrc || product.image?.src || null,
        updatedAt: new Date()
      }
    });
    
    // Log the update
    await db.auditLog.create({
      data: {
        action: 'product_updated',
        resource: 'product',
        resourceId: `gid://shopify/Product/${product.id}`,
        shopId: shop,
        metadata: JSON.stringify({
          productTitle: product.title,
          productHandle: product.handle
        })
      }
    });
    
    log.info(`Successfully processed product update for ${product.id}`, {
      productId: product.id,
      productTitle: product.title,
      shop
    });
  } catch (error) {
    log.error("Error processing product update webhook", error as Error, {
      productId: product.id,
      shop
    });
    // Don't fail the webhook - log and continue
  }
  
  return new Response(null, { status: 200 });
};