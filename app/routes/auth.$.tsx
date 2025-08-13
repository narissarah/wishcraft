import { login, authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Shopify OAuth Authentication Route
 * Handles all /auth/* routes for the OAuth flow
 * Built for Shopify 2025 compliance
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // If this is the login path, use login() instead of authenticate.admin()
  if (url.pathname === "/auth/login") {
    return login(request);
  }
  
  // For all other auth paths, use authenticate.admin()
  await authenticate.admin(request);

  return null;
}