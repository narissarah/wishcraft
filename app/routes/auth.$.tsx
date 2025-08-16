import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";

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
  
  // Dynamically import login to avoid initialization issues
  console.log("[AUTH] Loader called for:", url.pathname);
  
  try {
    const { login } = await import("~/shopify.server");
    return login(request);
  } catch (error) {
    console.error("[AUTH] Login failed:", error);
    throw error;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  
  // Dynamically import login to avoid initialization issues
  console.log("[AUTH] Action called for:", url.pathname);
  
  try {
    const { login } = await import("~/shopify.server");
    return login(request);
  } catch (error) {
    console.error("[AUTH] Action login failed:", error);
    throw error;
  }
}

// Required for embedded apps - error boundary
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Required for embedded apps - headers
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};