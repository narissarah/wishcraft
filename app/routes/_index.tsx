import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // Check if this is coming from Shopify admin (embedded context)
  const isEmbedded = url.searchParams.get("embedded") === "1" || 
                     url.searchParams.get("shop") ||
                     request.headers.get("sec-fetch-dest") === "iframe";
  
  if (isEmbedded) {
    // Redirect to the main app route for embedded context
    return redirect("/app");
  }
  
  // For non-embedded access, could show a public landing page or redirect to app
  return redirect("/app");
};

// This route should not render anything as it always redirects
export default function Index() {
  return null;
}