import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

/**
 * OAuth Callback Route
 * Handles Shopify OAuth callback after authorization
 * Following 2025 security best practices with embedded auth strategy
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle OAuth callback flow
  // This processes the authorization code and completes the OAuth flow
  return await authenticate.admin(request);
};