import { redirect } from "@remix-run/node";
import { createCookieSessionStorage } from "@remix-run/node";
import { SHOPIFY_CONFIG } from "~/config/shopify.config";
import { TIME_CONSTANTS } from "~/lib/constants";
import type { CustomerSession, GraphQLVariables } from "~/lib/types";
import crypto from "crypto";
import { fetchWithTimeout } from "~/lib/fetch-with-timeout.server";

// Lazy initialization to prevent serverless crashes
let sessionSecret: string | null = null;

function getSessionSecret(): string {
  if (!sessionSecret) {
    const secret = process.env['SESSION_SECRET'];
    
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required');
    }
    
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }
    
    sessionSecret = secret;
  }
  
  return sessionSecret;
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__wishcraft_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [getSessionSecret()],
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: TIME_CONSTANTS.SESSION_DURATION_ADMIN,
  },
});

export const customerSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__wishcraft_customer_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [getSessionSecret()],
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: TIME_CONSTANTS.SESSION_DURATION_CUSTOMER,
  },
});

export async function requireAdmin(request: Request) {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    if (!admin || !session) {
      throw new Error("Not authenticated");
    }

    return { admin, session };
  } catch (error) {
    throw redirect("/auth");
  }
}

export async function getAdmin(request: Request) {
  try {
    return await authenticate.admin(request);
  } catch (error) {
    return null;
  }
}


export async function requireCustomer(request: Request): Promise<CustomerSession> {
  const session = await getCustomerSession(request);
  
  if (!session) {
    throw redirect("/customer/login");
  }
  
  if (Date.now() > session.expiresAt) {
    throw redirect("/customer/login");
  }
  
  return session;
}

export async function getCustomerSession(request: Request): Promise<CustomerSession | null> {
  try {
    const cookieSession = await customerSessionStorage.getSession(
      request.headers.get("Cookie")
    );
    
    const sessionData = cookieSession.get("customerSession");
    if (!sessionData) return null;
    
    return JSON.parse(decryptSession(sessionData)) as CustomerSession;
  } catch (error) {
    return null;
  }
}

export async function createCustomerSession(
  customerId: string,
  accessToken: string,
  shop: string,
  expiresIn: number = 3600
): Promise<string> {
  const session: CustomerSession = {
    customerId,
    accessToken,
    shop,
    expiresAt: Date.now() + (expiresIn * 1000),
  };
  
  const encryptedSession = encryptSession(JSON.stringify(session));
  
  const cookieSession = await customerSessionStorage.getSession();
  cookieSession.set("customerSession", encryptedSession);
  
  return await customerSessionStorage.commitSession(cookieSession);
}

export async function destroyCustomerSession(request: Request): Promise<string> {
  const session = await customerSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  
  return await customerSessionStorage.destroySession(session);
}

function getEncryptionKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY'] || getSessionSecret();
  return Buffer.from(key.slice(0, 32), 'utf8');
}

function encryptSession(data: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptSession(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted data');
  }
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function makeCustomerAPIRequest(
  session: CustomerSession,
  query: string,
  variables?: GraphQLVariables
) {
  const response = await fetchWithTimeout(`https://shopify.com/${session.shop}/account/customer/api/${SHOPIFY_CONFIG.API_VERSION}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.accessToken}`,
      'X-Shopify-Customer-Access-Token': session.accessToken,
    },
    body: JSON.stringify({
      query,
      variables: variables || {}
    }),
    timeout: TIME_CONSTANTS.API_TIMEOUT_DEFAULT
  });
  
  if (!response.ok) {
    throw new Error(`Customer API request failed: ${response.statusText}`);
  }
  
  return await response.json();
}