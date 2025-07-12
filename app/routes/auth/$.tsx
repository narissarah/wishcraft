import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, shopify } from "~/shopify.server";

// Shopify 2025 Authentication Splat Route
// This handles all auth flows: /auth/login, /auth/callback, etc.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // Check if this is the login path
  if (url.pathname === "/auth/login") {
    // Use shopify.login() for the login path
    return shopify.login(request);
  }
  
  // For all other auth paths (callback, etc.), use authenticate.admin()
  // IMPORTANT: Must return the response from authenticate.admin()
  return await authenticate.admin(request);
};
