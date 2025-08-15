import { login } from "~/shopify.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

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