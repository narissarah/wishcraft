import { authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Shopify OAuth Callback Route
 * Handles the OAuth callback after user authorization
 * Built for Shopify 2025 compliance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  return null;
}