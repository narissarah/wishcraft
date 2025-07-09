import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type { ErrorBoundaryComponent } from "@remix-run/node";

/**
 * Initialize Sentry monitoring
 * Call this in your entry.server.tsx
 */
export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.log("Sentry DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    
    // Performance monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),
    
    // Integrations
    integrations: [
      // HTTP integration
      new Sentry.Integrations.Http({ tracing: true }),
      
      // Profiling
      nodeProfilingIntegration(),
      
      // Prisma integration
      new Sentry.Integrations.Prisma({ client: true }),
    ],
    
    // Release tracking
    release: process.env.COMMIT_SHA || "unknown",
    
    // Environment context
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request?.cookies) {
        event.request.cookies = "[FILTERED]";
      }
      
      // Add custom context
      event.contexts = {
        ...event.contexts,
        app: {
          app_version: process.env.npm_package_version,
          shop_count: process.env.SHOP_COUNT,
        },
      };
      
      // Filter out non-errors in production
      if (process.env.NODE_ENV === "production") {
        const error = hint.originalException;
        
        // Ignore certain errors
        if (error && typeof error === "object" && "status" in error) {
          // Ignore 4xx errors except 401 (auth issues)
          if (error.status >= 400 && error.status < 500 && error.status !== 401) {
            return null;
          }
        }
      }
      
      return event;
    },
    
    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "log") {
        return null;
      }
      
      // Sanitize data in breadcrumbs
      if (breadcrumb.data?.url?.includes("api_key")) {
        breadcrumb.data.url = "[FILTERED]";
      }
      
      return breadcrumb;
    },
  });

  // Set initial user/shop context
  Sentry.setTag("app", "wishcraft");
  Sentry.setContext("runtime", {
    node: process.version,
    platform: process.platform,
  });
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: unknown,
  context?: {
    shop?: string;
    user?: string;
    action?: string;
    metadata?: Record<string, any>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.shop) {
      scope.setTag("shop", context.shop);
    }
    
    if (context?.user) {
      scope.setUser({ id: context.user });
    }
    
    if (context?.action) {
      scope.setTag("action", context.action);
    }
    
    if (context?.metadata) {
      scope.setContext("metadata", context.metadata);
    }
    
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with level
 */
export function captureMessage(
  message: string,
  level: "debug" | "info" | "warning" | "error" = "info",
  context?: Record<string, any>
) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("additional", context);
    }
    
    Sentry.captureMessage(message, level);
  });
}

/**
 * Track performance transaction
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: "info",
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Handle uncaught errors and log them to Sentry
 */
export function handleError(error: Error) {
  console.error("Uncaught error:", error);
  
  // Capture to Sentry
  captureException(error, {
    action: "error_boundary",
    metadata: {
      component: "root",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Performance monitoring utilities
 */
export const Performance = {
  /**
   * Measure database query performance
   */
  async measureQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const transaction = startTransaction(`db.${queryName}`, "db.query");
    const span = transaction.startChild({
      op: "db",
      description: queryName,
    });
    
    try {
      const result = await queryFn();
      span.setStatus("ok");
      return result;
    } catch (error) {
      span.setStatus("internal_error");
      throw error;
    } finally {
      span.finish();
      transaction.finish();
    }
  },
  
  /**
   * Measure API call performance
   */
  async measureAPI<T>(
    apiName: string,
    apiFn: () => Promise<T>
  ): Promise<T> {
    const transaction = startTransaction(`api.${apiName}`, "http.client");
    
    try {
      const result = await apiFn();
      transaction.setStatus("ok");
      return result;
    } catch (error) {
      transaction.setStatus("internal_error");
      throw error;
    } finally {
      transaction.finish();
    }
  },
  
  /**
   * Track custom metrics
   */
  trackMetric(
    name: string,
    value: number,
    unit: string = "none",
    tags?: Record<string, string>
  ) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    
    if (transaction) {
      transaction.setMeasurement(name, value, unit);
      
      if (tags) {
        Object.entries(tags).forEach(([key, val]) => {
          transaction.setTag(key, val);
        });
      }
    }
  },
};

/**
 * Shop context for multi-tenant monitoring
 */
export function setShopContext(shopId: string, shopDomain?: string) {
  Sentry.setTag("shop.id", shopId);
  if (shopDomain) {
    Sentry.setTag("shop.domain", shopDomain);
  }
  Sentry.setContext("shop", {
    id: shopId,
    domain: shopDomain,
  });
}

/**
 * Clear sensitive context before handling new request
 */
export function clearSensitiveContext() {
  Sentry.setUser(null);
  Sentry.setTag("shop.id", undefined);
  Sentry.setTag("shop.domain", undefined);
}