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

  override componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Error logging handled by getDerivedStateFromError
  }
  
  handleReset = () => {
    this.setState({ hasError: false });
  };
  
  handleReload = () => {
    // Preserve all URL parameters when reloading
    // This ensures Shopify auth context is maintained
    window.location.href = window.location.href;
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Page title="Something went wrong">
          <Card>
            <BlockStack gap="400">
              <Banner tone="critical">
                <Text as="p">An unexpected error occurred. Please try again.</Text>
              </Banner>
              
              <BlockStack gap="200">
                <Button onClick={this.handleReset}>Try Again</Button>
                <Button variant="secondary" onClick={this.handleReload}>Reload Page</Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </Page>
      );
    }

    return this.props.children;
  }
}