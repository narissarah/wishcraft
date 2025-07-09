import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from "@remix-run/react";
import { Card, Page, Button, Text, BlockStack, InlineStack, Banner, Icon } from "@shopify/polaris";
import { RefreshMajor, BugMajor, AlertMinor } from "@shopify/polaris-icons";
import { handleCustomerAuthError } from "~/lib/customer-auth.server";
import { captureException } from '~/lib/monitoring.server';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackComponent?: React.ComponentType<{
    error: Error;
    errorInfo: React.ErrorInfo;
    retry: () => void;
  }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'application' | 'component' | 'route';
  context?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: NodeJS.Timeout | null = null;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to monitoring service
    this.logError(error, errorInfo);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry for transient errors
    if (this.isTransientError(error) && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry();
    }
  }

  private logError = (error: Error, errorInfo: React.ErrorInfo) => {
    const context = {
      component: this.props.context || 'Unknown',
      level: this.props.level || 'component',
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ErrorBoundary'
    };

    // Log to monitoring service
    captureException(error, {
      action: 'error_boundary',
      metadata: {
        ...context,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'SSR'
      }
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary: ${context.component}`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Context:', context);
      console.groupEnd();
    }
  };

  private isTransientError = (error: Error): boolean => {
    // Check if error is likely transient (network, timeout, etc.)
    const transientPatterns = [
      /network/i,
      /timeout/i,
      /fetch/i,
      /connection/i,
      /temporary/i,
      /rate limit/i
    ];

    return transientPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    );
  };

  private scheduleRetry = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, this.state.retryCount) * 1000;

    this.retryTimeout = setTimeout(() => {
      this.handleRetry();
    }, delay);
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    });
  };

  private handleReportError = () => {
    if (this.state.error && this.state.errorInfo) {
      // Send detailed error report
      const errorReport = {
        errorId: this.state.errorId,
        error: {
          name: this.state.error.name,
          message: this.state.error.message,
          stack: this.state.error.stack
        },
        errorInfo: this.state.errorInfo,
        context: this.props.context,
        level: this.props.level,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
        url: typeof window !== 'undefined' ? window.location.href : 'SSR'
      };

      // Send to error reporting service
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      }).catch(console.error);
    }
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent;
        return (
          <FallbackComponent
            error={this.state.error!}
            errorInfo={this.state.errorInfo!}
            retry={this.handleManualRetry}
          />
        );
      }

      // Default error UI based on level
      return this.renderDefaultErrorUI();
    }

    return this.props.children;
  }

  private renderDefaultErrorUI() {
    const { error, errorId, retryCount } = this.state;
    const { level = 'component' } = this.props;

    if (level === 'application') {
      return (
        <Page title="Application Error">
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Icon source={BugMajor} color="critical" />
                <Text variant="headingMd" as="h2">
                  Application Error
                </Text>
              </BlockStack>
              
              <Banner status="critical">
                <p>
                  We're sorry, but something went wrong. Our team has been notified and is working on a fix.
                </p>
                {errorId && (
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    Error ID: {errorId}
                  </p>
                )}
              </Banner>

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  icon={RefreshMajor}
                  onClick={this.handleManualRetry}
                  disabled={retryCount >= this.maxRetries}
                >
                  {retryCount >= this.maxRetries ? 'Maximum retries reached' : 'Try Again'}
                </Button>
                
                <Button
                  variant="secondary"
                  onClick={this.handleReportError}
                >
                  Report Problem
                </Button>
              </InlineStack>

              {process.env.NODE_ENV === 'development' && error && (
                <details style={{ marginTop: '16px' }}>
                  <summary>Error Details (Development)</summary>
                  <pre style={{ 
                    marginTop: '8px', 
                    padding: '8px', 
                    backgroundColor: '#f6f6f6', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto'
                  }}>
                    {error.stack}
                  </pre>
                </details>
              )}
            </BlockStack>
          </Card>
        </Page>
      );
    }

    if (level === 'route') {
      return (
        <div style={{ padding: '16px' }}>
          <Banner status="warning">
            <BlockStack gap="200">
              <Text as="p">This page encountered an error while loading.</Text>
              
              <InlineStack gap="200">
                <Button
                  size="slim"
                  onClick={this.handleManualRetry}
                  disabled={retryCount >= this.maxRetries}
                >
                  {retryCount >= this.maxRetries ? 'Max retries reached' : 'Retry'}
                </Button>
                
                <Button
                  size="slim"
                  variant="plain"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        </div>
      );
    }

    // Component level error
    return (
      <div style={{ padding: '8px', border: '1px solid #e1e1e1', borderRadius: '4px', backgroundColor: '#fafafa' }}>
        <BlockStack gap="200">
          <InlineStack gap="200" align="center">
            <Icon source={AlertMinor} color="subdued" />
            <Text variant="bodySm" tone="subdued">
              Component failed to load
            </Text>
          </InlineStack>
          
          <InlineStack gap="200" align="center">
            <Button
              size="slim"
              variant="secondary"
              onClick={this.handleManualRetry}
              disabled={retryCount >= this.maxRetries}
            >
              {retryCount >= this.maxRetries ? 'Failed' : 'Retry'}
            </Button>
          </InlineStack>
        </BlockStack>
      </div>
    );
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Specialized error boundaries for different contexts
export const ApplicationErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary level="application" context="Application">
    {children}
  </ErrorBoundary>
);

export const RouteErrorBoundary: React.FC<{ children: React.ReactNode; route?: string }> = ({ 
  children, 
  route 
}) => (
  <ErrorBoundary level="route" context={route || 'Route'}>
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ 
  children: React.ReactNode; 
  componentName?: string;
}> = ({ children, componentName }) => (
  <ErrorBoundary level="component" context={componentName || 'Component'}>
    {children}
  </ErrorBoundary>
);

/**
 * Authentication Error Boundary
 * Handles authentication failures gracefully with user-friendly messages
 */
export function AuthErrorBoundary() {
  const error = useRouteError();
  
  // Handle different types of errors
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 401:
        return <UnauthorizedError />;
      case 403:
        return <ForbiddenError />;
      case 404:
        return <NotFoundError />;
      default:
        return <GenericError status={error.status} statusText={error.statusText} />;
    }
  }
  
  // Handle authentication errors
  if (error instanceof Error) {
    const authError = handleCustomerAuthError(error);
    return <AuthenticationError error={authError} />;
  }
  
  return <GenericError />;
}

function UnauthorizedError() {
  return (
    <Page title="Authentication Required">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Sign in required
          </Text>
          
          <Text as="p">
            You need to sign in to access this page. Please authenticate with your account to continue.
          </Text>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url="/customer/login"
            >
              Customer Sign In
            </Button>
            
            <Button
              variant="secondary"
              url="/auth/login"
            >
              Admin Sign In
            </Button>
          </InlineStack>
          
          <Text as="p" variant="bodySm" tone="subdued">
            If you're having trouble signing in, please contact support or try again later.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}

function ForbiddenError() {
  return (
    <Page title="Access Denied">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Access denied
          </Text>
          
          <Text as="p">
            You don't have permission to access this resource. This could be because:
          </Text>
          
          <div>
            <ul>
              <li>The registry is private and you don't have access</li>
              <li>You need additional permissions for this feature</li>
              <li>Your session has expired</li>
            </ul>
          </div>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url="/customer/login"
            >
              Sign In Again
            </Button>
            
            <Button
              variant="secondary"
              url="/registries"
            >
              Browse Public Registries
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

function NotFoundError() {
  return (
    <Page title="Page Not Found">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Page not found
          </Text>
          
          <Text as="p">
            The page you're looking for doesn't exist or may have been moved.
          </Text>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url="/"
            >
              Go Home
            </Button>
            
            <Button
              variant="secondary"
              url="/registries"
            >
              Browse Registries
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

interface AuthenticationErrorProps {
  error: {
    error: string;
    code: string;
    statusCode: number;
  };
}

function AuthenticationError({ error }: AuthenticationErrorProps) {
  const isCustomerError = error.code.includes('CUSTOMER') || error.code.includes('TOKEN');
  
  return (
    <Page title="Authentication Error">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Authentication failed
          </Text>
          
          <Text as="p" tone="critical">
            {error.error}
          </Text>
          
          {error.code === 'TOKEN_EXPIRED' && (
            <Text as="p">
              Your session has expired. Please sign in again to continue.
            </Text>
          )}
          
          {error.code === 'ACCESS_DENIED' && (
            <Text as="p">
              Access was denied during authentication. Please check your permissions or try again.
            </Text>
          )}
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url={isCustomerError ? "/customer/login" : "/auth/login"}
            >
              {isCustomerError ? "Customer Sign In" : "Admin Sign In"}
            </Button>
            
            <Button
              variant="secondary"
              url="/"
            >
              Go Home
            </Button>
          </InlineStack>
          
          {error.code === 'AUTH_FAILED' && (
            <Text as="p" variant="bodySm" tone="subdued">
              If this problem persists, please contact support with error code: {error.code}
            </Text>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}

interface GenericErrorProps {
  status?: number;
  statusText?: string;
}

function GenericError({ status, statusText }: GenericErrorProps = {}) {
  return (
    <Page title="Something went wrong">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Oops! Something went wrong
          </Text>
          
          {status && (
            <Text as="p" tone="critical">
              Error {status}: {statusText || "An unexpected error occurred"}
            </Text>
          )}
          
          <Text as="p">
            We're sorry, but something unexpected happened. Please try again or contact support if the problem persists.
          </Text>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
            
            <Button
              variant="secondary"
              url="/"
            >
              Go Home
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

/**
 * Simple error boundary for authentication routes
 */
export function SimpleErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Authentication Required</h2>
        <p>Please sign in to continue.</p>
        <Link to="/customer/login">Sign In</Link>
      </div>
    );
  }
  
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p>Please try again or contact support.</p>
      <Link to="/">Go Home</Link>
    </div>
  );
}