import { authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Shopify OAuth Authentication Route
 * Handles all /auth/* routes for the OAuth flow
 * Built for Shopify 2025 compliance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  return null;
}