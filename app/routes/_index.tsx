import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // For embedded apps, Shopify handles authentication through the App Bridge
  // If we have a shop parameter, redirect to the app routes
  if (shop) {
    return redirect(`/app?shop=${shop}`);
  }
  
  // If no shop parameter, try to authenticate and redirect to app
  try {
    await authenticate.admin(request);
    return redirect("/app");
  } catch (error) {
    // If authentication fails, Shopify will handle the redirect
    throw error;
  }
};

// This route should not render anything as it always redirects
export default function Index() {
  return null;
}