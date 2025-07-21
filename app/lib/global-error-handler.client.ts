export function initializeGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  
  window.addEventListener("unhandledrejection", (event) => {
    // Log to monitoring service in production
    
    if (window.ENV?.NODE_ENV === "production" && window.Sentry) {
      try {
        window.Sentry.captureException(event.reason);
      } catch (sentryError) {
        // Fallback to console logging when Sentry fails
        // Error reporting failures handled silently for security
        // Store errors locally for later transmission if possible
        if (typeof localStorage !== 'undefined') {
          try {
            const errorLog = {
              timestamp: new Date().toISOString(),
              error: event.reason?.toString() || 'Unknown error',
              sentryError: sentryError?.toString()
            };
            localStorage.setItem(`error_${Date.now()}`, JSON.stringify(errorLog));
          } catch (storageError) {
            // Even localStorage failed, just log to console
            // Storage failure handled silently
          }
        }
      }
    }
    
    event.preventDefault();
  });
  
  window.addEventListener("error", (event) => {
    // Log to monitoring service in production
    
    if (window.ENV?.NODE_ENV === "production" && window.Sentry) {
      try {
        window.Sentry.captureException(event.error);
      } catch (sentryError) {
        // Fallback to console logging when Sentry fails
        // Error reporting failures handled silently for security
        // Store errors locally for later transmission if possible
        if (typeof localStorage !== 'undefined') {
          try {
            const errorLog = {
              timestamp: new Date().toISOString(),
              error: event.error?.toString() || 'Unknown error',
              sentryError: sentryError?.toString()
            };
            localStorage.setItem(`error_${Date.now()}`, JSON.stringify(errorLog));
          } catch (storageError) {
            // Even localStorage failed, just log to console
            // Storage failure handled silently
          }
        }
      }
    }
  });
}