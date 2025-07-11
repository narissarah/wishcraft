import Sentry from "./monitoring/sentry.server";
import { log } from "./logger.server";

/**
 * Initialize all monitoring services
 */
export function initSentry() {
  // Sentry is initialized automatically when imported
  log.info("Monitoring services initialized");
}

/**
 * Clear sensitive context between requests
 */
export function clearSensitiveContext() {
  Sentry.configureScope((scope) => {
    scope.clear();
  });
}

// Re-export Sentry functions
export {
  captureException,
  captureMessage,
  startTransaction,
  addBreadcrumb,
  profileFunction,
  SentryErrorBoundary,
} from "./monitoring/sentry.server";