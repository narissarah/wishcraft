import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import { log } from "~/lib/logger.server";

/**
 * Initialize Sentry for production error tracking
 * This provides comprehensive error monitoring and performance insights
 */

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    
    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in dev
    profilesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in dev
    
    // Integrations
    integrations: [
      new ProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true }),
      new Sentry.Integrations.Prisma({ client: true }),
    ],
    
    // Release tracking
    release: process.env.RAILWAY_DEPLOYMENT_ID || process.env.RENDER_GIT_COMMIT || "local",
    
    // Before send hook for filtering
    beforeSend(event, hint) {
      // Filter out non-error logs in production
      if (isProduction && event.level === "log") {
        return null;
      }
      
      // Redact sensitive data
      if (event.request) {
        if (event.request.cookies) {
          event.request.cookies = "[REDACTED]";
        }
        if (event.request.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["x-shopify-access-token"];
        }
      }
      
      // Add custom context
      event.extra = {
        ...event.extra,
        shopId: event.tags?.shop || "unknown",
        appVersion: "1.0.0",
      };
      
      return event;
    },
    
    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",
      // Random network errors
      "Network request failed",
      "NetworkError",
      // Shopify specific
      "ShopifyError: Request failed with status code 429",
    ],
    
    // Performance monitoring options
    autoSessionTracking: true,
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "debug") {
        return null;
      }
      return breadcrumb;
    },
  });

  log.info("Sentry initialized successfully", {
    environment: process.env.NODE_ENV,
    release: Sentry.getCurrentHub().getClient()?.getOptions().release,
  });
} else if (isProduction) {
  log.warn("Sentry DSN not configured in production!");
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    user?: { id: string; email?: string };
    shop?: string;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    // Set user context
    if (context?.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
      });
    }

    // Set shop context
    if (context?.shop) {
      scope.setTag("shop", context.shop);
    }

    // Set additional tags
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Set extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    // Capture the exception
    Sentry.captureException(error);
  });
}

/**
 * Capture custom message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, any>
) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Performance monitoring transaction
 */
export function startTransaction(name: string, op: string) {
  if (!process.env.SENTRY_DSN) return null;
  
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    level: "info",
    timestamp: Date.now() / 1000,
    data,
  });
}

/**
 * Profile a function execution
 */
export async function profileFunction<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction(name, "function");
  
  try {
    const result = await fn();
    transaction?.setStatus("ok");
    return result;
  } catch (error) {
    transaction?.setStatus("internal_error");
    throw error;
  } finally {
    transaction?.finish();
  }
}

/**
 * Sentry error boundary for React components
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

export default Sentry;