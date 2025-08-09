export function getSecurityHeaders(nonce: string, shop: string | null) {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (nonce) {
    headers["Content-Security-Policy"] = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' https://cdn.shopify.com;
      style-src 'self' 'unsafe-inline' https://cdn.shopify.com;
      img-src 'self' data: https://cdn.shopify.com;
      font-src 'self' https://fonts.gstatic.com;
      connect-src 'self' https://*.myshopify.com;
      frame-ancestors ${shop ? `https://${shop} https://admin.shopify.com` : 'none'};
    `.replace(/\s+/g, ' ').trim();
  }

  return headers;
}