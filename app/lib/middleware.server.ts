import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { requireAdminAuth, requireCustomerAuth, createAuthMiddleware, hasRequiredScopes } from "~/lib/auth.server";
import { validateCustomerAccess } from "~/lib/customer-auth.server";

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface AuthenticatedAdminContext {
  admin: any;
  session: any;
  shop: any;
}

export interface AuthenticatedCustomerContext {
  customer: any;
  session: any;
}

export interface ProtectedRouteOptions {
  requireAdmin?: boolean;
  requireCustomer?: boolean;
  requiredScopes?: string[];
  allowGuest?: boolean;
  registryAccess?: {
    registryId: string;
    requireOwner?: boolean;
  };
}

// ============================================================================
// ROUTE PROTECTION WRAPPERS
// ============================================================================

/**
 * Admin-only route wrapper
 * Ensures admin authentication and required scopes
 */
export function withAdminAuth<T extends Record<string, any> = {}>(
  handler: (args: LoaderFunctionArgs | ActionFunctionArgs, context: AuthenticatedAdminContext) => Promise<T>,
  options: { requiredScopes?: string[] } = {}
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs): Promise<T> => {
    const { admin, session, shop } = await requireAdminAuth(args.request);
    
    // Check required scopes
    if (options.requiredScopes && !hasRequiredScopes(session, options.requiredScopes)) {
      const url = new URL(args.request.url);
      throw redirect(`/admin/auth/scopes?required=${options.requiredScopes.join(',')}&redirect=${encodeURIComponent(url.pathname)}`);
    }
    
    return handler(args, { admin, session, shop });
  };
}

/**
 * Customer-only route wrapper
 * Ensures customer authentication via Customer Account API
 */
export function withCustomerAuth<T extends Record<string, any> = {}>(
  handler: (args: LoaderFunctionArgs | ActionFunctionArgs, context: AuthenticatedCustomerContext) => Promise<T>
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs): Promise<T> => {
    const session = await requireCustomerAuth(args.request);
    
    return handler(args, { customer: session, session });
  };
}

/**
 * Registry access wrapper
 * Validates customer access to specific registries
 */
export function withRegistryAccess<T extends Record<string, any> = {}>(
  handler: (
    args: LoaderFunctionArgs | ActionFunctionArgs, 
    context: { customer?: any; registry: any; hasAccess: boolean }
  ) => Promise<T>,
  options: { requireOwner?: boolean; allowGuest?: boolean } = {}
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs): Promise<T> => {
    const url = new URL(args.request.url);
    const registryId = args.params.registryId || url.searchParams.get("registryId");
    
    if (!registryId) {
      throw new Response("Registry ID required", { status: 400 });
    }
    
    const { hasAccess, customer, registry } = await validateCustomerAccess(args.request, registryId);
    
    // If guest access is not allowed and no customer is authenticated
    if (!options.allowGuest && !customer) {
      throw redirect(`/customer/login?redirect=${encodeURIComponent(url.pathname)}`);
    }
    
    // If owner access is required
    if (options.requireOwner && (!customer || registry?.customerId !== customer.customerId)) {
      throw new Response("Registry owner access required", { status: 403 });
    }
    
    // If no access at all
    if (!hasAccess && !options.allowGuest) {
      throw new Response("Access denied", { status: 403 });
    }
    
    return handler(args, { customer, registry, hasAccess });
  };
}

/**
 * Flexible authentication wrapper
 * Supports multiple authentication modes
 */
export function withAuth<T extends Record<string, any> = {}>(
  handler: (
    args: LoaderFunctionArgs | ActionFunctionArgs,
    context: {
      adminAuth?: AuthenticatedAdminContext;
      customerAuth?: AuthenticatedCustomerContext;
      isAuthenticated: boolean;
    }
  ) => Promise<T>,
  options: ProtectedRouteOptions = {}
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs): Promise<T> => {
    let adminAuth: AuthenticatedAdminContext | undefined;
    let customerAuth: AuthenticatedCustomerContext | undefined;
    
    // Try admin authentication
    if (options.requireAdmin) {
      const auth = await requireAdminAuth(args.request);
      
      // Check required scopes
      if (options.requiredScopes && !hasRequiredScopes(auth.session, options.requiredScopes)) {
        const url = new URL(args.request.url);
        throw redirect(`/admin/auth/scopes?required=${options.requiredScopes.join(',')}&redirect=${encodeURIComponent(url.pathname)}`);
      }
      
      adminAuth = auth;
    }
    
    // Try customer authentication
    if (options.requireCustomer) {
      const session = await requireCustomerAuth(args.request);
      customerAuth = { customer: session, session };
    }
    
    // Check if any authentication is required
    const isAuthenticated = !!(adminAuth || customerAuth);
    
    if ((options.requireAdmin || options.requireCustomer) && !isAuthenticated && !options.allowGuest) {
      const url = new URL(args.request.url);
      
      if (options.requireAdmin) {
        throw redirect(`/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
      } else {
        throw redirect(`/customer/login?redirect=${encodeURIComponent(url.pathname)}`);
      }
    }
    
    return handler(args, { adminAuth, customerAuth, isAuthenticated });
  };
}

// ============================================================================
// COMMON MIDDLEWARE PATTERNS
// ============================================================================

/**
 * Admin dashboard middleware
 * Standard admin authentication with common scopes
 */
export const withAdminDashboard = (handler: any) => 
  withAdminAuth(handler, { 
    requiredScopes: ["read_customers", "read_orders", "read_products"] 
  });

/**
 * Customer dashboard middleware
 * Customer authentication with registry access
 */
export const withCustomerDashboard = withCustomerAuth;

/**
 * Public registry middleware
 * Allow guest access to public registries
 */
export const withPublicRegistry = (handler: any) =>
  withRegistryAccess(handler, { allowGuest: true });

/**
 * Private registry middleware
 * Require customer authentication for registry access
 */
export const withPrivateRegistry = (handler: any) =>
  withRegistryAccess(handler, { allowGuest: false });

/**
 * Registry owner middleware
 * Require registry ownership
 */
export const withRegistryOwner = (handler: any) =>
  withRegistryAccess(handler, { requireOwner: true, allowGuest: false });

// ============================================================================
// ERROR BOUNDARY MIDDLEWARE
// ============================================================================

/**
 * Authentication error boundary
 * Handles authentication failures gracefully
 */
export function withAuthErrorBoundary<T extends Record<string, any> = {}>(
  handler: (args: LoaderFunctionArgs | ActionFunctionArgs) => Promise<T>
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs): Promise<T> => {
    try {
      return await handler(args);
    } catch (error) {
      // Handle authentication redirects
      if (error instanceof Response) {
        throw error;
      }
      
      // Log authentication errors
      console.error("Authentication error:", error);
      
      // Determine appropriate redirect
      const url = new URL(args.request.url);
      
      if (url.pathname.startsWith("/admin")) {
        throw redirect(`/auth/login?error=auth_failed&redirect=${encodeURIComponent(url.pathname)}`);
      } else if (url.pathname.startsWith("/customer")) {
        throw redirect(`/customer/login?error=auth_failed&redirect=${encodeURIComponent(url.pathname)}`);
      }
      
      throw redirect(`/?error=auth_failed`);
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract registry ID from request
 */
export function getRegistryId(args: LoaderFunctionArgs | ActionFunctionArgs): string | null {
  const url = new URL(args.request.url);
  return args.params.registryId || url.searchParams.get("registryId") || null;
}

/**
 * Check if request is from admin interface
 */
export function isAdminRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.startsWith("/admin") || url.searchParams.has("embedded");
}

/**
 * Check if request is from customer interface
 */
export function isCustomerRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.startsWith("/customer") || url.pathname.startsWith("/registry");
}