import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { handleProductsUpdate } from "~/lib/inventory-sync.server";

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
    await handleProductsUpdate(product, shop);
    console.log(`Successfully processed product update for ${product.id}`);
  } catch (error) {
    console.error(`Error processing product update webhook:`, error);
    // Don't fail the webhook - log and continue
  }
  
  return new Response(null, { status: 200 });
};