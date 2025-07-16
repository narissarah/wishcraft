import crypto from "crypto";
import { json } from "@remix-run/node";
import { sessionStorage } from "~/lib/auth.server";
import { log } from '~/lib/logger.server';

// ============================================================================
// CSRF PROTECTION IMPLEMENTATION
// ============================================================================

const CSRF_TOKEN_KEY = "csrf_token";
const CSRF_HEADER = "X-CSRF-Token";
const CSRF_FORM_FIELD = "_csrf";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Get or create CSRF token for a session
 */
export async function getCSRFToken(request: Request): Promise<string> {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  
  let token = session.get(CSRF_TOKEN_KEY);
  
  if (!token) {
    token = generateCSRFToken();
    session.set(CSRF_TOKEN_KEY, token);
  }
  
  return token;
}

/**
 * Validate CSRF token from request
 */
export async function validateCSRFToken(
  request: Request,
  options: { skipMethods?: string[] } = {}
): Promise<{ valid: boolean; error?: string }> {
  const { skipMethods = ["GET", "HEAD", "OPTIONS"] } = options;
  
  // Skip validation for safe methods
  if (skipMethods.includes(request.method)) {
    return { valid: true };
  }
  
  try {
    // Get session token
    const session = await sessionStorage.getSession(
      request.headers.get("Cookie")
    );
    const sessionToken = session.get(CSRF_TOKEN_KEY);
    
    if (!sessionToken) {
      return { valid: false, error: "No CSRF token in session" };
    }
    
    // Get request token (from header or body)
    let requestToken: string | null = null;
    
    // Check header first
    requestToken = request.headers.get(CSRF_HEADER);
    
    // If not in header, check form data
    if (!requestToken && request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      requestToken = formData.get(CSRF_FORM_FIELD) as string;
    }
    
    // If not in form, check JSON body
    if (!requestToken && request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      requestToken = body[CSRF_FORM_FIELD];
    }
    
    if (!requestToken) {
      return { valid: false, error: "No CSRF token in request" };
    }
    
    // Timing-safe comparison
    const valid = crypto.timingSafeEqual(
      Buffer.from(sessionToken),
      Buffer.from(requestToken)
    );
    
    return { valid, error: valid ? undefined : "Invalid CSRF token" };
  } catch (error) {
    log.error("CSRF validation error", error as Error);
    return { valid: false, error: "CSRF validation failed" };
  }
}

/**
 * CSRF protection middleware
 */
export async function csrfMiddleware(
  request: Request,
  options: { 
    skipMethods?: string[];
    skipPaths?: string[];
    regenerateOnFailure?: boolean;
  } = {}
) {
  const {
    skipMethods = ["GET", "HEAD", "OPTIONS"],
    skipPaths = ["/webhooks", "/api/health"],
    regenerateOnFailure = true
  } = options;
  
  // Skip validation for certain paths (like webhooks)
  const url = new URL(request.url);
  if (skipPaths.some(path => url.pathname.startsWith(path))) {
    return null;
  }
  
  // Skip validation for safe methods
  if (skipMethods.includes(request.method)) {
    return null;
  }
  
  const { valid, error } = await validateCSRFToken(request);
  
  if (!valid) {
    // Regenerate token on failure if configured
    if (regenerateOnFailure) {
      const session = await sessionStorage.getSession(
        request.headers.get("Cookie")
      );
      session.set(CSRF_TOKEN_KEY, generateCSRFToken());
      
      return json(
        { error: "CSRF validation failed", message: error },
        {
          status: 403,
          headers: {
            "Set-Cookie": await sessionStorage.commitSession(session),
          },
        }
      );
    }
    
    return json(
      { error: "CSRF validation failed", message: error },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * Create CSRF-protected form data
 */
export async function createCSRFFormData(
  request: Request,
  data: Record<string, any>
): Promise<FormData> {
  const token = await getCSRFToken(request);
  const formData = new FormData();
  
  formData.append(CSRF_FORM_FIELD, token);
  
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  
  return formData;
}

/**
 * Add CSRF token to headers
 */
export async function createCSRFHeaders(
  request: Request,
  headers: HeadersInit = {}
): Promise<HeadersInit> {
  const token = await getCSRFToken(request);
  
  return {
    ...headers,
    [CSRF_HEADER]: token,
  };
}

/**
 * React hook helper for CSRF tokens (for use in loaders)
 */
export async function getCSRFTokenForClient(request: Request): Promise<{
  csrfToken: string;
  csrfHeader: string;
  csrfField: string;
}> {
  const token = await getCSRFToken(request);
  
  // Commit session to ensure token is saved
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  
  return {
    csrfToken: token,
    csrfHeader: CSRF_HEADER,
    csrfField: CSRF_FORM_FIELD,
  };
}

/**
 * Validate and rotate CSRF token
 */
export async function rotateCSRFToken(request: Request): Promise<{
  newToken: string;
  cookie: string;
}> {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  
  const newToken = generateCSRFToken();
  session.set(CSRF_TOKEN_KEY, newToken);
  
  return {
    newToken,
    cookie: await sessionStorage.commitSession(session),
  };
}

/**
 * Double Submit Cookie Pattern implementation
 */
export function createCSRFCookie(token: string): string {
  return `csrf_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`;
}

/**
 * Validate double submit cookie
 */
export function validateDoubleSubmitCookie(
  cookieToken: string | null,
  requestToken: string | null
): boolean {
  if (!cookieToken || !requestToken) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(requestToken)
  );
}

/**
 * Apply CSRF protection to a loader/action
 */
export function withCSRFProtection<T extends (...args: any[]) => any>(
  handler: T,
  options: Parameters<typeof csrfMiddleware>[1] = {}
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0]?.request as Request;
    if (!request) {
      return handler(...args);
    }
    
    const csrfResponse = await csrfMiddleware(request, options);
    if (csrfResponse) {
      throw csrfResponse;
    }
    
    return handler(...args);
  }) as T;
}

/**
 * CSRF token input component helper
 */
export function CSRFTokenInput({ token }: { token: string }) {
  return `<input type="hidden" name="${CSRF_FORM_FIELD}" value="${token}" />`;
}

/**
 * Verify origin header for additional protection
 */
export function verifyOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  
  if (!origin && !referer) {
    // No origin or referer header (could be legitimate for some requests)
    return true;
  }
  
  const checkOrigin = origin || (referer ? new URL(referer).origin : null);
  
  if (!checkOrigin) {
    return false;
  }
  
  return allowedOrigins.includes(checkOrigin);
}

/**
 * Complete CSRF protection wrapper with origin validation
 */
export function withCompleteCSRFProtection<T extends (...args: any[]) => any>(
  handler: T,
  options: {
    allowedOrigins?: string[];
    csrfOptions?: Parameters<typeof csrfMiddleware>[1];
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0]?.request as Request;
    if (!request) {
      return handler(...args);
    }
    
    // Verify origin
    const allowedOrigins = options.allowedOrigins || [
      process.env.SHOPIFY_APP_URL || "",
      "https://admin.shopify.com",
    ];
    
    if (!verifyOrigin(request, allowedOrigins)) {
      throw json(
        { error: "Origin validation failed" },
        { status: 403 }
      );
    }
    
    // Verify CSRF token
    const csrfResponse = await csrfMiddleware(request, options.csrfOptions);
    if (csrfResponse) {
      throw csrfResponse;
    }
    
    return handler(...args);
  }) as T;
}