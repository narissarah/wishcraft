import { login } from "~/shopify.server";
import type { LoaderFunctionArgs, ActionFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import { useRouteError } from "@remix-run/react";

/**
 * Explicit /auth/login route to ensure it takes precedence
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[AUTH.LOGIN] Explicit login route called");
  return login(request);
}

export async function action({ request }: ActionFunctionArgs) {
  console.log("[AUTH.LOGIN] Explicit login action called");
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