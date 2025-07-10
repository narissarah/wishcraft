import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

/**
 * Admin OAuth Authentication Route (Catch-all)
 * Handles Shopify app installation and authorization flow
 * Following 2025 security best practices with embedded auth strategy
 * 
 * Note: This catch-all route specifically excludes /auth/login
 * which is handled by the auth.login.tsx route
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // Check if this is the login path - if so, let auth.login.tsx handle it
  if (url.pathname === '/auth/login') {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Use Shopify's built-in authentication flow for all other auth paths
  // This handles the complete OAuth 2.0 flow including:
  // - Initial authorization redirect
  // - Token exchange
  // - Session creation
  // - Shop initialization via afterAuth hook
  return await authenticate.admin(request);
};