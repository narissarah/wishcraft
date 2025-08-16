import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";

/**
 * Explicit /auth/login route to ensure it takes precedence
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[AUTH.LOGIN] Explicit login route called");
  // Dynamic import to avoid initialization issues
  const { login } = await import("~/shopify.server");
  return login(request);
}

export async function action({ request }: ActionFunctionArgs) {
  console.log("[AUTH.LOGIN] Explicit login action called");
  // Dynamic import to avoid initialization issues
  const { login } = await import("~/shopify.server");
  return login(request);
}

// Required for embedded apps - error boundary
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Required for embedded apps - headers
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};