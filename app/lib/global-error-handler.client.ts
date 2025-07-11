export function initializeGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    
    if (window.ENV?.NODE_ENV === "production" && window.Sentry) {
      try {
        window.Sentry.captureException(event.reason);
      } catch (error) {
        console.error("Failed to report unhandled rejection to Sentry:", error);
      }
    }
    
    event.preventDefault();
  });
  
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    
    if (window.ENV?.NODE_ENV === "production" && window.Sentry) {
      try {
        window.Sentry.captureException(event.error);
      } catch (error) {
        console.error("Failed to report global error to Sentry:", error);
      }
    }
  });
}