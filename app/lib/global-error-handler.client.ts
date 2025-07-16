export function initializeGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  
  window.addEventListener("unhandledrejection", (event) => {
    // Log to monitoring service in production
    
    if (window.ENV?.NODE_ENV === "production" && window.Sentry) {
      try {
        window.Sentry.captureException(event.reason);
      } catch (error) {
        // Failed to report to monitoring service
      }
    }
    
    event.preventDefault();
  });
  
  window.addEventListener("error", (event) => {
    // Log to monitoring service in production
    
    if (window.ENV?.NODE_ENV === "production" && window.Sentry) {
      try {
        window.Sentry.captureException(event.error);
      } catch (error) {
        // Failed to report to monitoring service
      }
    }
  });
}