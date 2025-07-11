import React from "react";
import { Banner, Page, Text, Button, BlockStack } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    this.setState({ errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    if (typeof window !== "undefined" && window.ENV?.NODE_ENV === "production") {
      try {
        if (window.Sentry) {
          window.Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack
              }
            }
          });
        }
      } catch (sentryError) {
        console.error("Failed to report error to Sentry:", sentryError);
      }
    }
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };
  
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const isAuthError = this.state.error?.message?.includes("authenticate") || 
                         this.state.error?.message?.includes("401") ||
                         this.state.error?.message?.includes("Unauthorized");
      
      const isDevelopment = typeof window !== "undefined" && 
                           window.ENV?.NODE_ENV === "development";

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

    return this.props.children;
  }
}

export function ErrorBoundaryResetButton() {
  const navigate = useNavigate();
  
  return (
    <Button onClick={() => navigate(0)}>
      Reset
    </Button>
  );
}