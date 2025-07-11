import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

// Shopify 2025 Authentication Splat Route
// This handles all auth flows: /auth/login, /auth/callback, etc.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
