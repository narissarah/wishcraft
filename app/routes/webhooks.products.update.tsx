import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "PRODUCTS_UPDATE") {
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received PRODUCTS_UPDATE webhook for ${shop}`);

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
    
    console.log(`Successfully processed product update for ${product.id}`);
  } catch (error) {
    console.error(`Error processing product update webhook:`, error);
    // Don't fail the webhook - log and continue
  }
  
  return new Response(null, { status: 200 });
};