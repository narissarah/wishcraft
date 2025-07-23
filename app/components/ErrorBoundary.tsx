/**
 * Simplified Error Boundary for WishCraft
 * Basic error handling without over-engineering
 */

import React from "react";
import { Banner, Page, Text, Button, BlockStack, Card } from "@shopify/polaris";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error("Error caught by boundary:", error, errorInfo);
    
    // Simple error reporting in production
    if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
      try {
        // Report to error endpoint
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          })
        }).catch(() => {
          // Silently handle reporting errors
        });
      } catch {
        // Silently handle errors in error reporting
      }
    }
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
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
      
      if (isAuthError) {
        return (
          <Page title="Authentication Required">
            <Card>
              <BlockStack gap="400">
                <Banner tone="warning">
                  <Text as="p">Your session has expired. Please log in again.</Text>
                </Banner>
                <Button 
                  onClick={() => window.location.href = '/auth'}
                  variant="primary"
                >
                  Log In
                </Button>
              </BlockStack>
            </Card>
          </Page>
        );
      }

      return (
        <Page title="Something went wrong">
          <Card>
            <BlockStack gap="400">
              <Banner tone="critical">
                <Text as="p">
                  An unexpected error occurred. Please try again.
                </Text>
              </Banner>
              
              {process.env.NODE_ENV === "development" && this.state.error && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">Error Details:</Text>
                    <Text as="p">
                      <code>{this.state.error.message}</code>
                    </Text>
                    {this.state.error.stack && (
                      <Text as="p" tone="subdued">
                        <pre>{this.state.error.stack}</pre>
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              )}
              
              <BlockStack gap="200">
                <Button onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button variant="secondary" onClick={this.handleReload}>
                  Reload Page
                </Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </Page>
      );
    }

    return this.props.children;
  }
}