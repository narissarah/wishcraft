import type { ActionFunctionArgs } from "@remix-run/node";
import { processWebhook } from "~/lib/webhook.server";

export async function action({ request }: ActionFunctionArgs) {
  return processWebhook(request);
}

// Webhooks should only accept POST requests
export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}