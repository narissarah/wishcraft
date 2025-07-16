/**
 * Security Headers Configuration for WishCraft
 * Implements comprehensive security headers for Shopify 2025 compliance
 */

export interface SecurityHeadersOptions {
  nonce?: string;
  shop?: string;
  development?: boolean;
}

/**
 * Generate security headers for responses
 */
export function getSecurityHeaders(requestOrOptions: Request | SecurityHeadersOptions = {}): Record<string, string> {
  let options: SecurityHeadersOptions = {};
  
  if (requestOrOptions instanceof Request) {
    // Extract options from Request
    const url = new URL(requestOrOptions.url);
    options = {
      shop: url.searchParams.get('shop') || undefined,
      development: process.env.NODE_ENV !== 'production'
    };
  } else {
    options = requestOrOptions;
  }
  const { nonce, shop, development = false } = options;
  
  const headers: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': generateCSP({ nonce, shop, development }),
    
    // Security headers
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    
    // HSTS (only in production)
    ...(development ? {} : {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
  };
  
  return headers;
}

function generateCSP({ nonce, shop, development }: SecurityHeadersOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"} https://cdn.shopify.com`,
    "style-src 'self' 'unsafe-inline' https://cdn.shopify.com",
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.myshopify.com",
    "frame-src 'self' https://*.myshopify.com",
    "object-src 'none'",
    "base-uri 'self'"
  ];
  
  if (shop) {
    directives.push(`frame-ancestors https://${shop}.myshopify.com https://admin.shopify.com`);
  }
  
  if (development) {
    directives.push("connect-src 'self' ws: wss: https://*.myshopify.com");
  }
  
  return directives.join('; ');
}

/**
 * Generate a cryptographic nonce for CSP
 */
export function generateNonce(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('base64');
}