import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // Test what happens when we import shopify
  let shopifyError = null;
  try {
    const { shopify } = await import("~/shopify.server");
    // Don't call anything, just import
  } catch (error: any) {
    shopifyError = error.message;
  }
  
  // Test what happens when we import login
  let loginError = null;
  try {
    const { login } = await import("~/shopify.server");
    // Don't call anything, just import
  } catch (error: any) {
    loginError = error.message;
  }
  
  return json({
    path: url.pathname,
    shopifyImportError: shopifyError,
    loginImportError: loginError,
    env: {
      SHOPIFY_APP_URL: !!process.env.SHOPIFY_APP_URL,
      SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
    }
  });
}