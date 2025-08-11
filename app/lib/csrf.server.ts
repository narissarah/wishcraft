import crypto from "crypto";
import { createCookieSessionStorage } from "@remix-run/node";
import type { SessionStorage } from "@remix-run/node";
import { SHOPIFY_CONFIG } from '~/config/shopify.config';

// Lazy initialization for serverless
let csrfStorage: SessionStorage | null = null;

function getCsrfStorage(): SessionStorage {
  if (!csrfStorage) {
    const secret = process.env['SESSION_SECRET'];
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required for CSRF protection');
    }
    
    csrfStorage = createCookieSessionStorage({
      cookie: {
        name: '__csrf',
        sameSite: 'lax',
        path: '/',
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        secrets: [secret],
        maxAge: SHOPIFY_CONFIG.SECURITY.TOKEN_EXPIRY / 1000, // Convert to seconds
      },
    });
  }
  return csrfStorage;
}

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get or create CSRF token for a request
 */
export async function getCSRFToken(request: Request): Promise<string> {
  const session = await getCsrfStorage().getSession(request.headers.get('Cookie'));
  let token = session.get('token') as string | undefined;
  
  if (!token) {
    token = generateCSRFToken();
    session.set('token', token);
  }
  
  return token;
}

/**
 * Get the Set-Cookie header for CSRF token
 */
export async function getCSRFCookieHeader(request: Request): Promise<string> {
  const session = await getCsrfStorage().getSession(request.headers.get('Cookie'));
  const token = (session.get('token') as string | undefined) || generateCSRFToken();
  session.set('token', token);
  
  return await getCsrfStorage().commitSession(session);
}

/**
 * Validate CSRF token from request
 */
export async function validateCSRFToken(request: Request): Promise<boolean> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }
  
  // Skip CSRF for webhook endpoints (they have their own verification)
  const url = new URL(request.url);
  if (url.pathname.startsWith('/webhooks/')) {
    return true;
  }
  
  // Get token from session
  const session = await getCsrfStorage().getSession(request.headers.get('Cookie'));
  const sessionToken = session.get('token') as string | undefined;
  
  if (!sessionToken) {
    throw new Response('CSRF token missing from session', { status: 403 });
  }
  
  // Get token from request (header or body)
  let requestToken: string | null = null;
  
  // Check header first
  requestToken = request.headers.get('X-CSRF-Token');
  
  // If not in header, check body for form submissions
  if (!requestToken && request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    requestToken = formData.get('_csrf') as string;
  }
  
  // If not in header or form, check JSON body
  if (!requestToken && request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.json();
      requestToken = body._csrf;
    } catch {
      // Body parsing failed, token remains null
    }
  }
  
  if (!requestToken) {
    throw new Response('CSRF token missing from request', { status: 403 });
  }
  
  // Compare tokens
  if (requestToken !== sessionToken) {
    throw new Response('CSRF token mismatch', { status: 403 });
  }
  
  return true;
}

/**
 * CSRF protection middleware for action functions
 */
export async function requireCSRFToken(request: Request): Promise<void> {
  const isValid = await validateCSRFToken(request);
  if (!isValid) {
    throw new Response('CSRF validation failed', { status: 403 });
  }
}

/**
 * Helper to add CSRF token to forms
 * Usage: Pass the token string to your form component
 * Example: <input type="hidden" name="_csrf" value={token} />
 */