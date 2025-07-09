import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { destroyCustomerSession } from "~/lib/auth.server";

/**
 * Customer Logout Route
 * Safely destroys customer session and redirects
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionCookie = await destroyCustomerSession(request);
  
  const headers = {
    "Set-Cookie": sessionCookie,
  };
  
  return redirect("/", { headers });
};

export const loader = async () => {
  return redirect("/");
};