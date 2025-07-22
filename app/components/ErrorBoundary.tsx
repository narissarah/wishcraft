import React from "react";
import { Banner, Page, Text, Button, BlockStack, Card } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";
// Removed server import to reduce bundle size
// Generate error ID using secure crypto (fallback for client-side)
function generateClientErrorId(): string {
  // Use crypto.getRandomValues if available, fallback to timestamp + secure method
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    const randomString = Array.from(array, byte => byte.toString(36)).join('');
    return `error_${Date.now()}_${randomString}`;
  }
  // Server-side fallback
  return `error_${Date.now()}_${Date.now().toString(36)}`;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'component' | 'widget';
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorId: '', retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = generateClientErrorId();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error logging handled by logger.server.ts
    
    this.setState({ errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Report to monitoring services
    this.reportError(error, errorInfo);
    
    // Auto-retry for transient errors
    if (this.isTransientError(error) && this.state.retryCount < 3) {
      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: undefined,
          errorInfo: undefined,
          retryCount: prevState.retryCount + 1
        }));
      }, 1000 * Math.pow(2, this.state.retryCount)); // Exponential backoff
    }
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, retryCount: 0 });
  };
  
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const isAuthError = !!(this.state.error?.message?.includes("authenticate") || 
                         this.state.error?.message?.includes("401") ||
                         this.state.error?.message?.includes("Unauthorized"));
      
      const isDevelopment = typeof window !== "undefined" && 
                           window.ENV?.NODE_ENV === "development";
      
      const level = this.props.level || 'page';
      
      return this.renderErrorByLevel(level, isAuthError, !!isDevelopment);
    }

    return this.props.children;
  }

  private isTransientError(error: Error): boolean {
    const transientMessages = [
      'network',
      'timeout',
      'connection',
      'fetch',
      'load'
    ];
    
    return transientMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }
  
  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    if (typeof window !== "undefined" && window.ENV?.NODE_ENV === "production") {
      try {
        // Report to Sentry
        if (window.Sentry) {
          window.Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack
              }
            },
            tags: {
              errorBoundary: true,
              level: this.props.level || 'page',
              errorId: this.state.errorId
            }
          });
        }
        
        // Report to performance monitoring
        if (navigator.sendBeacon) {
          const data = JSON.stringify({
            type: 'error',
            errorId: this.state.errorId,
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            level: this.props.level || 'page',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
          });
          
          navigator.sendBeacon('/api/errors', data);
        }
      } catch (reportError) {
        // Error reporting failure handled silently for security
      }
    }
  }
  
  private renderErrorByLevel(level: string, isAuthError: boolean, isDevelopment: boolean) {
    switch (level) {
      case 'widget':
        return this.renderWidgetError(isAuthError, isDevelopment);
      case 'component':
        return this.renderComponentError(isAuthError, isDevelopment);
      case 'page':
      default:
        return this.renderPageError(isAuthError, isDevelopment);
    }
  }
  
  private renderWidgetError(isAuthError: boolean, isDevelopment: boolean) {
    return (
      <div style={{ 
        padding: "8px", 
        border: "1px solid #e1e1e1", 
        borderRadius: "4px", 
        backgroundColor: "#fff5f5",
        color: "#c53030",
        fontSize: "0.875rem"
      }}>
        <Text as="span" tone="critical">
          {isAuthError ? "Authentication required" : "Widget unavailable"}
        </Text>
        {!isAuthError && (
          <Button size="micro" onClick={this.handleReset}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  private renderComponentError(isAuthError: boolean, isDevelopment: boolean) {
    return (
      <Card>
        <BlockStack gap="200">
          <Banner tone="critical">
            <Text as="h3" variant="headingSm">
              {isAuthError ? "Authentication Error" : "Component Error"}
            </Text>
            <Text as="p">
              {isAuthError 
                ? "Please log in to access this feature."
                : "This component encountered an error."}
            </Text>
          </Banner>
          
          <BlockStack gap="200">
            <Button size="medium" onClick={this.handleReset}>
              Try Again
            </Button>
            {isDevelopment && this.state.error && (
              <details>
                <summary>Error Details (Development)</summary>
                <pre style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </BlockStack>
        </BlockStack>
      </Card>
    );
  }
  
  private renderPageError(isAuthError: boolean, isDevelopment: boolean) {
    return (
      <Page title="Something went wrong">
        <BlockStack gap="400">
          <Banner tone="critical">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                {isAuthError ? "Authentication Error" : "Unexpected Error"}
              </Text>
              <Text as="p">
                {isAuthError 
                  ? "There was a problem with authentication. Please try logging in again."
                  : "An unexpected error occurred. Please try refreshing the page."}
              </Text>
              {this.state.retryCount > 0 && (
                <Text as="p" tone="subdued">
                  Auto-retry attempted {this.state.retryCount} time{this.state.retryCount > 1 ? 's' : ''}
                </Text>
              )}
              {isDevelopment && this.state.error && (
                <details style={{ marginTop: "1rem" }}>
                  <summary style={{ cursor: "pointer" }}>Error Details</summary>
                  <pre style={{ 
                    padding: "1rem", 
                    background: "#f4f4f4", 
                    borderRadius: "4px",
                    overflow: "auto",
                    fontSize: "0.875rem",
                    marginTop: "0.5rem"
                  }}>
                    Error ID: {this.state.errorId}
                    {this.state.error.toString()}
                    {this.state.error.stack && `\n\nStack:\n${this.state.error.stack}`}
                    {this.state.errorInfo?.componentStack && `\n\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
                  </pre>
                </details>
              )}
            </BlockStack>
          </Banner>
          
          <BlockStack gap="200">
            <Button variant="primary" onClick={this.handleReload}>
              Refresh Page
            </Button>
            {!isAuthError && (
              <Button onClick={this.handleReset}>
                Try Again
              </Button>
            )}
            {isAuthError && (
              <Button url="/auth/login">
                Go to Login
              </Button>
            )}
          </BlockStack>
        </BlockStack>
      </Page>
    );
  }
}

// Higher-order component for easy error boundary wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for manually triggering error boundaries
export function useErrorHandler() {
  return React.useCallback((error: Error) => {
    // This will be caught by the nearest error boundary
    throw error;
  }, []);
}

// Reset button component
export function ErrorBoundaryResetButton() {
  const navigate = useNavigate();
  
  return (
    <Button onClick={() => navigate(0)}>
      Reset
    </Button>
  );
}