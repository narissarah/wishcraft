import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request,
  );

  if (!admin && topic === "APP_UNINSTALLED") {
    throw new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received APP_UNINSTALLED webhook for ${shop}`);

  // Clean up app data when uninstalled
  // TODO: Implement cleanup logic for registries, customer data, etc.
  
  return new Response(null, { status: 200 });
};