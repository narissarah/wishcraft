/**
 * Security headers for WishCraft
 * Essential security headers for Shopify apps
 */

import { generateCSP } from "./csp.server";

/**
 * Get security headers for responses
 */
export function getSecurityHeaders(nonce: string, shop?: string | null): Record<string, string> {
  return {
    // CSP header
    'Content-Security-Policy': generateCSP(nonce, shop),
    
    // Clickjacking protection
    'X-Frame-Options': shop ? 'ALLOWALL' : 'DENY', // ALLOWALL for Shopify embedded apps
    
    // Basic security headers
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // HSTS in production
    ...(process.env.NODE_ENV === 'production' ? {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    } : {})
  };
}