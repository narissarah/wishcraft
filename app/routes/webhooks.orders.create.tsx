import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "ORDERS_CREATE") {
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received ORDERS_CREATE webhook for ${shop}`);

  const order = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  // Process order for gift registry functionality
  // TODO: Check if order contains registry items
  // TODO: Update registry item status
  // TODO: Send notifications to registry owner
  
  return new Response(null, { status: 200 });
};