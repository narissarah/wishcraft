import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { log } from "~/lib/logger.server";

/**
 * Built for Shopify requirement: Protect iFrames and prevent domains 
 * other than the shop domain from using the app in an iFrame
 */
export function validateIframeRequest(request: Request, shop: string | null): boolean {
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  
  // If not in iframe (no referer), allow
  if (!referer && !origin) {
    return true;
  }
  
  // List of allowed origins
  const allowedOrigins = [
    'https://admin.shopify.com',
    'https://partners.shopify.com',
  ];
  
  // Add shop-specific origin if we have a shop
  if (shop) {
    allowedOrigins.push(`https://${shop}`);
    allowedOrigins.push(`https://${shop}.myshopify.com`);
  }
  
  // Check if request is from allowed origin
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);
  
  if (requestOrigin) {
    const isAllowed = allowedOrigins.some(allowed => 
      requestOrigin === allowed || requestOrigin.startsWith(allowed)
    );
    
    if (!isAllowed) {
      log.warn('Iframe request from unauthorized origin blocked', {
        requestOrigin,
        shop,
        host,
      });
    }
    
    return isAllowed;
  }
  
  return true;
}

/**
 * Middleware to check iframe embedding authorization
 */
export async function requireValidIframe({ request }: LoaderFunctionArgs, shop: string | null) {
  if (!validateIframeRequest(request, shop)) {
    log.error('Unauthorized iframe embedding attempt', {
      referer: request.headers.get("referer"),
      origin: request.headers.get("origin"),
      shop,
    });
    
    // Redirect to an error page or return forbidden
    throw new Response("Forbidden: This app can only be embedded in authorized Shopify domains", {
      status: 403,
      headers: {
        "X-Frame-Options": "DENY",
      },
    });
  }
}

/**
 * Get frame-ancestors CSP directive based on shop
 */
export function getFrameAncestorsDirective(shop: string | null): string {
  const ancestors = ["https://admin.shopify.com", "https://partners.shopify.com"];
  
  if (shop) {
    ancestors.push(`https://${shop}`);
    ancestors.push(`https://${shop}.myshopify.com`);
  }
  
  return ancestors.join(" ");
}