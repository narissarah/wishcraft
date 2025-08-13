export function getSecurityHeaders(nonce: string, shop: string | null) {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };

  if (nonce) {
    headers["Content-Security-Policy"] = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' https://cdn.shopify.com https://www.google-analytics.com;
      style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://fonts.googleapis.com;
      img-src 'self' data: https://cdn.shopify.com https://*.myshopify.com;
      font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com;
      connect-src 'self' https://*.myshopify.com https://analytics.google.com;
      frame-ancestors ${shop ? `https://${shop}.myshopify.com https://admin.shopify.com` : 'none'};
      frame-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s+/g, ' ').trim();
  }

  return headers;
}