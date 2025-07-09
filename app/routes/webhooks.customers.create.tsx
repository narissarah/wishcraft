import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "CUSTOMERS_CREATE") {
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received CUSTOMERS_CREATE webhook for ${shop}`);

  const customer = typeof payload === 'string' ? JSON.parse(payload) : payload;
  
  // Process new customer for gift registry functionality
  // TODO: Set up customer profile for registry creation
  // TODO: Send welcome email with registry information
  
  return new Response(null, { status: 200 });
};