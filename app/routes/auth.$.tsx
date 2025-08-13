import { login } from "~/shopify.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

/**
 * Shopify OAuth Authentication Route
 * Handles all /auth/* routes for the OAuth flow
 * Built for Shopify 2025 compliance
 * 
 * IMPORTANT: This route should ONLY use login() for /auth/login
 * to avoid the "authenticate.admin() from configured login path" error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // Debug logging
  console.log("[AUTH] Loader called for:", url.pathname);
  
  // The auth.$ route handles ALL /auth/* paths
  // For the login flow, we must use login()
  if (url.pathname === "/auth/login" || url.pathname.startsWith("/auth/login")) {
    console.log("[AUTH] Using login() for path:", url.pathname);
    return login(request);
  }
  
  // For callback and other auth paths, still use login() 
  // as authenticate.admin() should not be called from auth routes
  console.log("[AUTH] Using login() for OAuth flow:", url.pathname);
  return login(request);
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  
  // Debug logging
  console.log("[AUTH] Action called for:", url.pathname);
  
  // For all auth routes, use login()
  return login(request);
}