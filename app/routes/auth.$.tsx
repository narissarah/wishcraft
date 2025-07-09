import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

/**
 * Admin OAuth Authentication Route
 * Handles Shopify app installation and authorization flow
 * Following 2025 security best practices with embedded auth strategy
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Use Shopify's built-in authentication flow
  // This handles the complete OAuth 2.0 flow including:
  // - Initial authorization redirect
  // - Token exchange
  // - Session creation
  // - Shop initialization via afterAuth hook
  return await authenticate.admin(request);
};