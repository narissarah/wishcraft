import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

/**
 * API Auth Route
 * Alternative auth endpoint for API-based authentication
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return await authenticate.admin(request);
};