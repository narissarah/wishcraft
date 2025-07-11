import { redirect } from "@remix-run/node";
import { createCookieSessionStorage } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { db } from "~/lib/db.server";
import crypto from "crypto";

// ============================================================================
// SESSION MANAGEMENT (2025 SECURITY STANDARDS)
// ============================================================================

// Ensure SESSION_SECRET is set in production
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      '🚨 CRITICAL: SESSION_SECRET is not set in production!\n' +
      'Generate a secure secret with: node scripts/generate-secrets.js'
    );
  }
  
  // Only use dev secret in development
  if (!secret && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  Using development session secret. Set SESSION_SECRET for production.');
    return 'dev-secret-for-local-development-only-change-in-production';
  }
  
  return secret!;
}

const sessionSecret = getSessionSecret();

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__wishcraft_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

export const customerSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__wishcraft_customer",
    httpOnly: true,
    path: "/",
    sameSite: "lax", 
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days for customer sessions
  },
});

// ============================================================================
// ADMIN AUTHENTICATION (SHOPIFY APP)
// ============================================================================

// 2025 Simplified Admin Auth - Shopify handles redirects automatically
export async function requireAdminAuth(request: Request) {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    // Verify shop exists in our database (optional - create if not exists)
    let shop = await db.shop.findUnique({
      where: { id: session.shop },
      include: { settings: true }
    });
    
    if (!shop) {
      // Auto-create shop record for new installations
      shop = await db.shop.create({
        data: {
          id: session.shop,
          name: session.shop.replace('.myshopify.com', ''),
          email: '',
          domain: session.shop,
          currencyCode: 'USD',
          settings: {
            create: {
              enablePasswordProtection: false,
              enableGiftMessages: true,
              enableSocialSharing: true,
              enableEmailNotifications: true,
              maxItemsPerRegistry: 100,
              appActive: true,
              appUninstalledAt: null
            }
          }
        },
        include: { settings: true }
      });
    }
    
    return { admin, session, shop };
  } catch (error) {
    if (error instanceof Response) {
      throw error; // Re-throw Shopify redirects
    }
    
    console.error("Admin authentication failed:", error);
    throw new Response("Authentication failed", { status: 401 });
  }
}

// Safe admin auth that doesn't throw
export async function getAdminAuth(request: Request) {
  try {
    return await authenticate.admin(request);
  } catch (error) {
    // In 2025, authentication errors are handled by Shopify automatically
    return null;
  }
}

// ============================================================================
// CUSTOMER AUTHENTICATION (CUSTOMER ACCOUNT API)
// ============================================================================

interface CustomerSession {
  customerId: string;
  accessToken: string;
  refreshToken?: string;
  shop: string;
  expiresAt: number;
  scope: string[];
}

export async function requireCustomerAuth(request: Request): Promise<CustomerSession> {
  const session = await getCustomerSession(request);
  
  if (!session) {
    throw redirect("/customer/login");
  }
  
  // Check if token is expired
  if (Date.now() > session.expiresAt) {
    // Try to refresh token
    const refreshedSession = await refreshCustomerToken(session);
    if (!refreshedSession) {
      throw redirect("/customer/login");
    }
    return refreshedSession;
  }
  
  return session;
}

export async function getCustomerSession(request: Request): Promise<CustomerSession | null> {
  try {
    const cookieSession = await customerSessionStorage.getSession(
      request.headers.get("Cookie")
    );
    
    const encryptedSession = cookieSession.get("customerSession");
    if (!encryptedSession) {
      return null;
    }
    
    // Decrypt and validate session
    const sessionData = decryptSession(encryptedSession);
    return JSON.parse(sessionData) as CustomerSession;
  } catch (error) {
    console.error("Failed to get customer session:", error);
    return null;
  }
}

export async function createCustomerSession(
  customerId: string,
  accessToken: string,
  shop: string,
  scope: string[],
  expiresIn: number = 3600,
  refreshToken?: string
): Promise<string> {
  const session: CustomerSession = {
    customerId,
    accessToken,
    refreshToken,
    shop,
    expiresAt: Date.now() + (expiresIn * 1000),
    scope
  };
  
  const encryptedSession = encryptSession(JSON.stringify(session));
  
  const cookieSession = await customerSessionStorage.getSession();
  cookieSession.set("customerSession", encryptedSession);
  
  return await customerSessionStorage.commitSession(cookieSession);
}

export async function destroyCustomerSession(request: Request): Promise<string> {
  const cookieSession = await customerSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  
  return await customerSessionStorage.destroySession(cookieSession);
}

async function refreshCustomerToken(session: CustomerSession): Promise<CustomerSession | null> {
  if (!session.refreshToken) {
    return null;
  }
  
  try {
    const response = await fetch(`https://shopify.com/${session.shop}/account/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
        client_id: process.env.SHOPIFY_API_KEY!,
        client_secret: process.env.SHOPIFY_API_SECRET!,
      }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const tokenData = await response.json();
    
    return {
      ...session,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || session.refreshToken,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    };
  } catch (error) {
    console.error("Token refresh failed:", error);
    return null;
  }
}

// ============================================================================
// CUSTOMER ACCOUNT API UTILITIES
// ============================================================================

export async function makeCustomerAPIRequest(
  session: CustomerSession,
  query: string,
  variables?: any
) {
  // Use stable API version for Customer Account API
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
  const response = await fetch(
    `https://shopify.com/${session.shop}/account/customer/api/${apiVersion}/graphql`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "Origin": process.env.SHOPIFY_APP_URL!,
        "User-Agent": "WishCraft/1.0",
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Customer API request failed: ${response.status}`);
  }
  
  return await response.json();
}

export async function getCustomerProfile(session: CustomerSession) {
  const query = `#graphql
    query GetCustomer {
      customer {
        id
        email
        firstName
        lastName
        displayName
        phoneNumber {
          phoneNumber
        }
        defaultAddress {
          id
          address1
          address2
          city
          province
          zip
          country
        }
      }
    }
  `;
  
  return await makeCustomerAPIRequest(session, query);
}

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

// Get encryption key (separate from session secret for better security)
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  
  if (!encryptionKey && process.env.NODE_ENV === 'production') {
    throw new Error(
      '🚨 CRITICAL: ENCRYPTION_KEY is not set in production!\n' +
      'Generate a secure key with: node scripts/generate-secrets.js'
    );
  }
  
  const key = encryptionKey || sessionSecret;
  return crypto.scryptSync(key, 'wishcraft-salt-v1', 32);
}

const encryptionKey = getEncryptionKey();

function encryptSession(data: string): string {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  cipher.setAAD(Buffer.from('wishcraft-session'));
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptSession(encryptedData: string): string {
  const algorithm = 'aes-256-gcm';
  
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
  decipher.setAAD(Buffer.from('wishcraft-session'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateSessionSecret(): string {
  return crypto.randomBytes(32).toString('base64');
}

export function isValidShopDomain(shop: string): boolean {
  if (!shop || typeof shop !== 'string') {
    return false;
  }
  
  // Remove protocol if present
  shop = shop.replace(/^https?:\/\//, '');
  
  // Check if it's a valid myshopify.com domain
  const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  
  return shopifyDomainRegex.test(shop);
}

export function validateWebhookSignature(hmac: string, params: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET!;
  const sortedParams = new URLSearchParams();
  
  // Sort and filter parameters
  for (const [key, value] of params.entries()) {
    if (key !== 'hmac' && key !== 'signature') {
      sortedParams.append(key, value);
    }
  }
  
  const queryString = sortedParams.toString();
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );
  } catch (error) {
    // Handle cases where HMAC lengths don't match
    return false;
  }
}

// ============================================================================
// SCOPE MANAGEMENT
// ============================================================================

export interface ScopeRequest {
  scopes: string[];
  reason: string;
  optional?: boolean;
}

export async function requestAdditionalScopes(
  request: Request,
  scopeRequest: ScopeRequest
): Promise<Response> {
  const { session } = await requireAdminAuth(request);
  
  // Check current scopes
  const currentScopes = session.scope?.split(',') || [];
  const requestedScopes = scopeRequest.scopes;
  const missingScopes = requestedScopes.filter(scope => !currentScopes.includes(scope));
  
  if (missingScopes.length === 0) {
    return new Response(JSON.stringify({ success: true, message: "All scopes already granted" }));
  }
  
  // For embedded apps, redirect to scope request
  const scopeUrl = new URL(`https://${session.shop}/admin/oauth/authorize`);
  scopeUrl.searchParams.set('client_id', process.env.SHOPIFY_API_KEY!);
  scopeUrl.searchParams.set('scope', [...currentScopes, ...missingScopes].join(','));
  scopeUrl.searchParams.set('redirect_uri', `${process.env.SHOPIFY_APP_URL}/auth/callback`);
  scopeUrl.searchParams.set('state', generateState());
  
  return redirect(scopeUrl.toString());
}

export function hasRequiredScopes(session: any, requiredScopes: string[]): boolean {
  const currentScopes = session.scope?.split(',') || [];
  return requiredScopes.every(scope => currentScopes.includes(scope));
}

// ============================================================================
// ROUTE PROTECTION MIDDLEWARE
// ============================================================================

export function createAuthMiddleware(options: {
  requireAdmin?: boolean;
  requireCustomer?: boolean; 
  requiredScopes?: string[];
  redirectTo?: string;
}) {
  return async function authMiddleware(request: Request) {
    const url = new URL(request.url);
    const redirectTo = options.redirectTo || `/auth/login?redirect=${encodeURIComponent(url.pathname)}`;
    
    let adminAuth = null;
    let customerAuth = null;
    
    // Check admin authentication
    if (options.requireAdmin) {
      try {
        adminAuth = await requireAdminAuth(request);
        
        // Check required scopes
        if (options.requiredScopes && !hasRequiredScopes(adminAuth.session, options.requiredScopes)) {
          throw redirect(`/auth/scopes?required=${options.requiredScopes.join(',')}&redirect=${encodeURIComponent(url.pathname)}`);
        }
      } catch (error) {
        if (error instanceof Response) throw error;
        throw redirect(redirectTo);
      }
    }
    
    // Check customer authentication
    if (options.requireCustomer) {
      try {
        customerAuth = await requireCustomerAuth(request);
      } catch (error) {
        if (error instanceof Response) throw error;
        throw redirect(`/customer/login?redirect=${encodeURIComponent(url.pathname)}`);
      }
    }
    
    return { adminAuth, customerAuth };
  };
}

// ============================================================================
// WEBSOCKET AUTHENTICATION
// ============================================================================

export interface WebSocketAuthResult {
  shopId: string;
  customerId?: string;
  isAdmin: boolean;
  scopes: string[];
}

export async function authenticateWebSocket(
  token: string,
  shop: string
): Promise<WebSocketAuthResult | null> {
  try {
    // Try admin authentication first
    const adminSession = await verifyAdminToken(token, shop);
    if (adminSession) {
      return {
        shopId: shop,
        isAdmin: true,
        scopes: adminSession.scope?.split(',') || [],
      };
    }
    
    // Try customer authentication
    const customerSession = await verifyCustomerToken(token, shop);
    if (customerSession) {
      return {
        shopId: shop,
        customerId: customerSession.customerId,
        isAdmin: false,
        scopes: customerSession.scope,
      };
    }
    
    return null;
  } catch (error) {
    console.error('WebSocket authentication failed:', error);
    return null;
  }
}

export async function verifyAdminToken(token: string, shop: string): Promise<any> {
  try {
    // Use GraphQL Admin API with latest stable version
    const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
    const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `#graphql
          query VerifyShop {
            shop {
              id
              name
              email
            }
          }
        `
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.data?.shop) {
        return { 
          scope: 'read_customers,write_orders,read_products',
          shop: result.data.shop
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Admin token verification failed:', error);
    return null;
  }
}

async function verifyCustomerToken(token: string, shop: string): Promise<CustomerSession | null> {
  try {
    // Decrypt customer token
    const decryptedToken = decryptSession(token);
    const session = JSON.parse(decryptedToken) as CustomerSession;
    
    // Verify token is not expired
    if (Date.now() > session.expiresAt) {
      return null;
    }
    
    // Verify shop matches
    if (session.shop !== shop) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Customer token verification failed:', error);
    return null;
  }
}