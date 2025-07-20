import { authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * API Authentication Route
 * Alternative OAuth entry point
 * Built for Shopify 2025 compliance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  return null;
}